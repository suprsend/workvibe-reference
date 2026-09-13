// WorkVibe seed script — the DATA-PLANE side of setup.
//
//   node --env-file=.env.local scripts/provision.mjs workspaces
//   node --env-file=.env.local scripts/provision.mjs brand
//   node --env-file=.env.local scripts/provision.mjs users
//   node --env-file=.env.local scripts/provision.mjs all        (all of the above, in this order)
//
// The reference assets (preference categories, templates, workflows) are NOT
// pushed from here — they are CLI-native files under suprsend/<workspace>/ and
// `npm run push:assets` (scripts/push-assets.mjs) publishes them with the
// official `suprsend` CLI. This script covers only what the CLI has no commands
// for: workspaces, tenants (brand), and users/lists — the data plane.
//
// `workspaces` creates (or reuses) each workspace declared in lib/workspaces.ts
// in your SuprSend account, then appends any MISSING per-workspace credential
// lines to .env.local for you to fill from the dashboard. It does NOT create
// public / signing / API keys — those dashboard values don't map 1:1 to what
// the app needs (the Workspace Key+Secret ≠ the REST API Key, and the JWT
// needs the signing key UID, not its ID). Create the workspace here; paste the
// keys yourself. See the README.
//
// Every stage is idempotent: `workspaces` reuses by name (never duplicates —
// SuprSend workspaces can't be deleted), `brand` upserts the default tenant,
// and `users` re-runs never re-send a welcome (an existing list member does
// not re-enter the list).

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const ENV_LOCAL = resolve(ROOT, ".env.local");
const WORKSPACES_TS = resolve(ROOT, "lib/workspaces.ts");
const MGMNT = (process.env.SUPRSEND_MGMNT_URL || "https://management-api.suprsend.com").replace(/\/+$/, "");
const TOKEN = process.env.SUPRSEND_SERVICE_TOKEN;

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function readJson(relPath) {
  return JSON.parse(readFileSync(resolve(HERE, relPath), "utf8"));
}

// ── Parse the workspace registry (single source of truth) ────────────────────
function readWorkspaces() {
  if (!existsSync(WORKSPACES_TS)) die(`Cannot find ${WORKSPACES_TS}`);
  const src = readFileSync(WORKSPACES_TS, "utf8");
  const slugs = [...src.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
  const fullNames = [...src.matchAll(/fullName:\s*"([^"]+)"/g)].map((m) => m[1]);
  if (slugs.length === 0) die("No workspace slugs found in lib/workspaces.ts");
  return slugs.map((slug, i) => ({ slug, description: fullNames[i] ?? slug }));
}

const envPrefix = (slug) => `SUPRSEND_${slug.replace(/-/g, "_").toUpperCase()}`;
const publicPrefix = (slug) => `NEXT_PUBLIC_${envPrefix(slug)}`;

// The env vars the app actually reads, per workspace (verified against the code).
function requiredVars(slug) {
  const p = envPrefix(slug);
  const pub = publicPrefix(slug);
  return [
    { name: `${p}_WORKSPACE_KEY`, note: "Workspace Key (Developers → API Keys → Workspace Key and Secret)" },
    { name: `${p}_WORKSPACE_SECRET`, note: "Workspace Secret (same section; dashboard-only)" },
    { name: `${p}_SIGNING_KEY_UID`, note: 'Signing Key UID (signing_key_…) — NOT the ID (ws_signk_…)' },
    { name: `${p}_SIGNING_KEY_B64`, note: "Signing key PEM, base64-encoded (see README)" },
    { name: `${pub}_PUBLIC_KEY`, note: "Public Key (SS.PUBK…) — browser inbox SDK" },
  ];
}

// ── SuprSend Management API (workspaces only — assets go through the CLI) ────
function authHeaders() {
  return { Authorization: `ServiceToken ${TOKEN}`, "Content-Type": "application/json" };
}

function asArray(body) {
  return body?.results || body?.data || body?.workspaces || (Array.isArray(body) ? body : []);
}

// List ALL workspaces (the endpoint is paginated: meta.count / limit / offset —
// a first-page-only check would miss workspaces created earlier and duplicate them).
async function listAllWorkspaces() {
  const all = [];
  const limit = 100;
  let offset = 0;
  for (let guard = 0; guard < 100; guard++) {
    const res = await fetch(`${MGMNT}/v1/workspace/?limit=${limit}&offset=${offset}`, { headers: authHeaders() });
    if (!res.ok) die(`List workspaces failed: HTTP ${res.status}`);
    const body = await res.json().catch(() => ({}));
    const page = asArray(body);
    all.push(...page);
    const count = body?.meta?.count ?? all.length;
    offset += limit;
    if (page.length === 0 || all.length >= count) break;
  }
  return all;
}

async function createWorkspace(slug, description) {
  const res = await fetch(`${MGMNT}/v1/workspace/`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name: slug, description }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) die(`Create "${slug}" failed: HTTP ${res.status} ${JSON.stringify(body)}`);
  return body;
}

// ── .env.local: append only the missing per-workspace lines ──────────────────
function existingEnvNames() {
  if (!existsSync(ENV_LOCAL)) {
    writeFileSync(ENV_LOCAL, "# WorkVibe local environment — do not commit\n");
    return new Set();
  }
  const names = new Set();
  for (const line of readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=/);
    if (m) names.add(m[1]);
  }
  return names;
}

function appendMissing(slug, present) {
  const missing = requiredVars(slug).filter((v) => !present.has(v.name));
  if (missing.length === 0) return 0;
  const block =
    `\n# ── Workspace: ${slug} (added by provision.mjs — paste values from the dashboard) ──\n` +
    missing.map((v) => `# ${v.note}\n${v.name}=`).join("\n") +
    "\n";
  appendFileSync(ENV_LOCAL, block);
  missing.forEach((v) => present.add(v.name));
  return missing.length;
}

// ── Stage: workspaces ─────────────────────────────────────────────────────────
async function cmdWorkspaces() {
  const targets = readWorkspaces();
  console.log(`Provisioning ${targets.length} workspace(s) against ${MGMNT}\n`);

  const existing = await listAllWorkspaces();
  const bySlug = new Map(existing.map((w) => [w.slug, w]));
  const byName = new Map(existing.map((w) => [w.name, w]));

  for (const { slug, description } of targets) {
    let ws = bySlug.get(slug) || byName.get(slug);
    if (ws) {
      console.log(`✓ ${slug} — reused (uid ${ws.uid ?? "?"})`);
    } else {
      ws = await createWorkspace(slug, description);
      console.log(`＋ ${slug} — created (uid ${ws.uid ?? "?"})`);
    }
  }

  console.log("\nUpdating .env.local …");
  const present = existingEnvNames();
  let total = 0;
  for (const { slug } of targets) {
    const added = appendMissing(slug, present);
    total += added;
    console.log(added ? `  ${slug}: added ${added} missing line(s)` : `  ${slug}: all vars present`);
  }
  console.log(
    total > 0
      ? `\nDone. Fill the ${total} new blank line(s) in .env.local from the dashboard, then restart the dev server.`
      : "\nDone. All workspace credential lines already present in .env.local.",
  );
}

// The distinct_id the editor preview renders against: the FIRST subscriber seeded
// for that workspace. It must be a real user — `provision.mjs users` creates it —
// and it's derived rather than named so the roster stays the single source of
// truth and every id keeps the same `u_xxxxx` shape a real signup would have.
function previewRecipient(ws) {
  return (readJson("seed-data/users.json")[ws] ?? [])[0]?.distinct_id ?? null;
}

// ── Stage: brand ───────────────────────────────────────────────────────────────
// Seed each workspace's `default` tenant — the brand templates resolve through
// {{$brand.*}}. Left unseeded, the tenant keeps the name the SuprSend ACCOUNT was
// created with, so every customer's mail is signed by the notification vendor
// rather than the customer. Runs before assets are exercised for that reason.
// Upsert merges, so fields the seed omits (logo, social links) keep whatever the
// admin set in Brand Settings. Tenants live on the hub, not the Management API,
// so like `users` this stage needs the per-workspace WORKSPACE_KEY/SECRET.
async function cmdBrand() {
  const { Suprsend } = await import("@suprsend/node-sdk");
  const brands = readJson("seed-data/brands.json");

  for (const { slug } of readWorkspaces()) {
    const p = envPrefix(slug);
    const key = process.env[`${p}_WORKSPACE_KEY`];
    const secret = process.env[`${p}_WORKSPACE_SECRET`];
    console.log(`\n=== ${slug} ===`);
    if (!key || !secret) {
      console.log(`  ✗ ${p}_WORKSPACE_KEY / _WORKSPACE_SECRET not set — paste them from the dashboard first`);
      continue;
    }
    const brand = brands[slug];
    if (!brand) {
      console.log("  – no brand seeded for this workspace");
      continue;
    }
    try {
      await new Suprsend(key, secret).tenants.upsert("default", brand);
      console.log(`  ✓ brand → ${brand.tenant_name}`);
    } catch (e) {
      console.log(`  ✗ ${e?.message ?? e}`);
    }
  }
}

// ── Stage: users ──────────────────────────────────────────────────────────────
// Seeds the demo consumers. These stand in for people who signed up in the
// CUSTOMER's own product, so this stage — not an admin typing into WorkVibe — is
// where a consumer enters the system. Each one is added to the all-subscribers
// list, and joining that list is what welcomes them: SuprSend emits
// $USER_ENTERED_LIST and the onboarding workflow runs. An existing member does not
// re-enter, so re-running never re-sends a welcome.
//
// The first entry is the preview recipient every template's mock_data points at.
// Without it the editor preview has no $recipient and every {{$recipient.*}}
// reports «"name" not defined in [object Object]».
//
// This stage talks to the hub rather than the Management API — user ingestion is
// SDK-only, so it needs the per-workspace WORKSPACE_KEY/SECRET (the Service Token
// alone can't do it).
const SUBSCRIBERS_LIST = "all-subscribers";

// create() is an upsert, so this both creates the list and keeps its settings correct on
// re-runs. `track_user_entry` is what makes SuprSend emit `$USER_ENTERED_LIST - <list_id>`;
// without it the list-entry welcome workflow can never fire. The hub API accepts the field
// but silently ignores it (verified: create() echoes back track_user_entry: false, and no
// PATCH/PUT exists on /v1/subscriber_list/), so it can only be enabled from the dashboard —
// and it must be ON BEFORE members join: an existing member never re-enters, so anyone who
// joined while it was off is never welcomed, even after enabling it. Hence the loud check.
async function ensureList(client) {
  await client.subscriber_lists
    .create({
      list_id: SUBSCRIBERS_LIST,
      list_name: "All subscribers",
      list_description: "Every consumer in this workspace — the broadcast audience.",
      track_user_entry: true, // sent, but ignored by the API — see the check below
    })
    .catch(() => {});
  try {
    const list = await client.subscriber_lists.get(SUBSCRIBERS_LIST);
    if (!list?.track_user_entry) {
      console.log(`  ⚠ "${SUBSCRIBERS_LIST}" has user-entry tracking OFF — the welcome workflow will NOT fire.`);
      console.log("    Enable it on the list in the SuprSend dashboard BEFORE seeding users; members who");
      console.log("    joined while it was off never fire $USER_ENTERED_LIST and are never welcomed.");
    }
  } catch {
    // best-effort check only — never block seeding on it
  }
}

async function cmdUsers() {
  const { Suprsend } = await import("@suprsend/node-sdk");
  const roster = readJson("seed-data/users.json");

  for (const { slug } of readWorkspaces()) {
    const p = envPrefix(slug);
    const key = process.env[`${p}_WORKSPACE_KEY`];
    const secret = process.env[`${p}_WORKSPACE_SECRET`];
    console.log(`\n=== ${slug} ===`);
    if (!key || !secret) {
      console.log(`  ✗ ${p}_WORKSPACE_KEY / _WORKSPACE_SECRET not set — paste them from the dashboard first`);
      continue;
    }
    const people = roster[slug] ?? [];
    if (people.length === 0) {
      console.log("  – no users seeded for this workspace");
      continue;
    }

    const client = new Suprsend(key, secret);
    await ensureList(client);

    for (const person of people) {
      const { distinct_id: id, name, email } = person;
      try {
        let existed = false;
        try {
          const u = await client.users.get(id);
          existed = Boolean(u?.distinct_id);
        } catch {
          existed = false;
        }

        const edit = client.users.get_edit_instance(id);
        if (email) edit.add_email(email);
        if (name) edit.set({ name });
        await client.users.edit(edit);
        // Joining the list IS the signup moment: SuprSend emits $USER_ENTERED_LIST and
        // the welcome workflow runs. Re-provisioning is safe — an existing member does
        // not re-enter, so nobody is welcomed twice.
        await client.subscriber_lists.add(SUBSCRIBERS_LIST, [id]).catch(() => {});

        const note = existed ? "updated" : "created + added to list";
        const preview = id === previewRecipient(slug) ? "  (template preview recipient)" : "";
        console.log(`  ✓ ${id.padEnd(14)} ${(name ?? "").padEnd(14)} ${note}${preview}`);
      } catch (e) {
        console.log(`  ✗ ${id}: ${e?.message ?? e}`);
      }
    }
  }
}

async function main() {
  if (!TOKEN) die("SUPRSEND_SERVICE_TOKEN is not set (run with --env-file=.env.local).");
  const stage = process.argv[2];
  if (stage === "workspaces") await cmdWorkspaces();
  else if (stage === "brand") await cmdBrand();
  else if (stage === "users") await cmdUsers();
  else if (stage === "all") { await cmdWorkspaces(); await cmdBrand(); await cmdUsers(); }
  else if (stage === "categories" || stage === "templates" || stage === "workflows") {
    die(`"${stage}" moved to the SuprSend CLI — run \`npm run push:assets\` (scripts/push-assets.mjs) instead.`);
  } else {
    console.log("Usage: node --env-file=.env.local scripts/provision.mjs <workspaces|brand|users|all>");
    process.exit(stage ? 1 : 0);
  }
}

await main();

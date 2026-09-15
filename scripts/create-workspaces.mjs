// Create the WorkVibe workspaces in your SuprSend account.
//
//   npm run create:workspaces
//   (= node --env-file=.env.local scripts/create-workspaces.mjs)
//
// Creates (or reuses) each workspace below, then appends any MISSING per-workspace
// credential lines to .env.local. The Workspace Key equals the workspace UID the API
// returns, so it is filled in for you. The secret, signing key and public key are
// dashboard-only, so those stay manual pastes. See the README.
//
// This is the only place the workspace names appear. The app reads the workspace
// list from the account and uses every workspace whose keys are in env.
//
// It creates no data — no brand, no users, no lists; people add those in the app.
// The reference assets (categories, templates, workflows) are pushed separately
// with the SuprSend CLI: `npm run push:assets`.
//
// Idempotent: workspaces are reused by name (never duplicated — SuprSend workspaces
// can't be deleted), and a non-empty env value is never overwritten.

import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();
const ENV_LOCAL = resolve(ROOT, ".env.local");
const MGMNT = (process.env.SUPRSEND_MGMNT_URL || "https://management-api.suprsend.com").replace(/\/+$/, "");
const TOKEN = process.env.SUPRSEND_SERVICE_TOKEN;

// The two example customers, each its own SuprSend workspace. The slugs match the
// asset folders under suprsend/, which is how `push:assets` finds them.
const WORKSPACES = [
  { slug: "workvibe-emberoak", description: "Ember & Oak — Diner Communications" },
  { slug: "workvibe-nolans", description: "Nolan's Pizza — Diner Communications" },
];

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const envPrefix = (slug) => `SUPRSEND_${slug.replace(/-/g, "_").toUpperCase()}`;
const publicPrefix = (slug) => `NEXT_PUBLIC_${envPrefix(slug)}`;

// The env vars the app actually reads, per workspace (verified against the code).
function requiredVars(slug) {
  const p = envPrefix(slug);
  const pub = publicPrefix(slug);
  return [
    // The Workspace Key equals the workspace UID that GET /v1/workspace/ returns,
    // so it is filled automatically. Everything else is dashboard-only.
    { name: `${p}_WORKSPACE_KEY`, note: "Workspace Key — auto-filled by create-workspaces.mjs (equals the workspace UID)" },
    { name: `${p}_WORKSPACE_SECRET`, note: "Workspace Secret (same section; dashboard-only)" },
    { name: `${p}_SIGNING_KEY_UID`, note: 'Signing Key UID (signing_key_…) — NOT the ID (ws_signk_…)' },
    { name: `${p}_SIGNING_KEY_B64`, note: "Signing key PEM, base64-encoded (see README)" },
    { name: `${pub}_PUBLIC_KEY`, note: "Public Key (SS.PUBK…) — browser inbox SDK" },
  ];
}

// ── SuprSend Management API ──────────────────────────────────────────────────
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

function appendMissing(slug, present, values = {}) {
  const missing = requiredVars(slug).filter((v) => !present.has(v.name));
  if (missing.length === 0) return 0;
  const block =
    `\n# ── Workspace: ${slug} (added by create-workspaces.mjs — paste values from the dashboard) ──\n` +
    missing.map((v) => `# ${v.note}\n${v.name}=${values[v.name] ?? ""}`).join("\n") +
    "\n";
  appendFileSync(ENV_LOCAL, block);
  missing.forEach((v) => present.add(v.name));
  return missing.filter((v) => !values[v.name]).length;
}

// Fill `NAME=` lines that are still EMPTY with a known value. A non-empty value —
// whatever it is — is the user's and is never touched, so re-runs are safe.
function fillEmptyEnv(name, value) {
  if (!value || !existsSync(ENV_LOCAL)) return false;
  const lines = readFileSync(ENV_LOCAL, "utf8").split("\n");
  let filled = false;
  const next = lines.map((line) => {
    if (new RegExp(`^\\s*${name}\\s*=\\s*$`).test(line)) {
      filled = true;
      return `${name}=${value}`;
    }
    return line;
  });
  if (filled) writeFileSync(ENV_LOCAL, next.join("\n"));
  return filled;
}

async function main() {
  if (!TOKEN) die("SUPRSEND_SERVICE_TOKEN is not set (run with --env-file=.env.local).");
  console.log(`Creating ${WORKSPACES.length} workspace(s) against ${MGMNT}\n`);

  const existing = await listAllWorkspaces();
  const bySlug = new Map(existing.map((w) => [w.slug, w]));
  const byName = new Map(existing.map((w) => [w.name, w]));

  const uids = new Map();
  for (const { slug, description } of WORKSPACES) {
    let ws = bySlug.get(slug) || byName.get(slug);
    if (ws) {
      console.log(`✓ ${slug} — reused (uid ${ws.uid ?? "?"})`);
    } else {
      ws = await createWorkspace(slug, description);
      console.log(`＋ ${slug} — created (uid ${ws.uid ?? "?"})`);
    }
    if (ws?.uid) uids.set(slug, ws.uid);
  }

  console.log("\nUpdating .env.local …");
  const present = existingEnvNames();
  let total = 0;
  for (const { slug } of WORKSPACES) {
    // The dashboard "Workspace Key" IS the workspace UID, so it never needs a
    // manual paste: new lines are written with it, and an existing-but-empty
    // line is filled in place. Non-empty values are never touched.
    const keyName = `${envPrefix(slug)}_WORKSPACE_KEY`;
    const hadKeyLine = present.has(keyName);
    const added = appendMissing(slug, present, { [keyName]: uids.get(slug) });
    const filled = fillEmptyEnv(keyName, uids.get(slug));
    total += added;
    const notes = [];
    if (added) notes.push(`added ${added} line(s) to fill`);
    if (filled || (!hadKeyLine && uids.get(slug))) notes.push("workspace key auto-filled");
    console.log(`  ${slug}: ${notes.length ? notes.join(", ") : "all vars present"}`);
  }
  console.log(
    total > 0
      ? `\nDone. Fill the ${total} new blank line(s) in .env.local from the dashboard, then restart the dev server.`
      : "\nDone. All workspace credential lines already present in .env.local.",
  );
}

await main();

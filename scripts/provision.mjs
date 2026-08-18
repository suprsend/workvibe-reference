// WorkVibe provisioning helper.
//
//   node --env-file=.env.local scripts/provision.mjs workspaces
//   node --env-file=.env.local scripts/provision.mjs categories
//   node --env-file=.env.local scripts/provision.mjs templates
//   node --env-file=.env.local scripts/provision.mjs workflows
//   node --env-file=.env.local scripts/provision.mjs users
//   node --env-file=.env.local scripts/provision.mjs all        (all of the above, in this order)
//
// `workspaces` creates (or reuses) each workspace declared in lib/workspaces.ts
// in your SuprSend account, then appends any MISSING per-workspace credential
// lines to .env.local for you to fill from the dashboard. It does NOT create
// public / signing / API keys — those dashboard values don't map 1:1 to what
// the app needs (the Workspace Key+Secret ≠ the REST API Key, and the JWT
// needs the signing key UID, not its ID). Create the workspace here; paste the
// keys yourself. See the README.
//
// `categories`, `templates`, and `workflows` publish the seed content in
// scripts/seed-data/ (ported verbatim from the live account, not invented) so a
// freshly-provisioned workspace ends up with the same setup WorkVibe ships
// with. `categories` MUST run before `workflows` — a workflow's `category`
// field is validated against these category slugs at creation time, and fails
// with a 400 ("'<category>' not found") if they don't exist yet. All three
// stages need SUPRSEND_SERVICE_TOKEN AND the per-workspace WORKSPACE_KEY/SECRET
// already filled in .env.local (i.e. run `workspaces` and paste the keys first).
//
// Every stage is idempotent: `workspaces` reuses by name (never duplicates —
// SuprSend workspaces can't be deleted), and `categories`/`templates`/`workflows`
// publish through the same commit flow the app itself uses, where an identical
// re-publish is a 409 "no_changes_to_commit" (treated as success, not a failure).

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
    { name: `${p}_SLACK_WEBHOOK`, note: "Slack incoming-webhook URL (optional)" },
  ];
}

// ── SuprSend Management API ───────────────────────────────────────────────────
function authHeaders() {
  return { Authorization: `ServiceToken ${TOKEN}`, "Content-Type": "application/json" };
}

async function call(ws, version, path, init) {
  const url = `${MGMNT}/${version}/${ws}/${path.replace(/^\//, "")}`;
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function isNoChanges(r) {
  return r.status === 409 && r.body?.error_code === "no_changes_to_commit";
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

// ── Template channel-content builders (ported verbatim from lib/suprsend-mgmt.ts,
//    so a seeded template publishes in exactly the shape the app itself uses) ──
// Email is pushed in VISUAL-DESIGNER mode: `design_json` is the block tree the
// editor canvas loads, `html` is what SuprSend renders and sends. Both go together
// — design_json alone leaves the canvas blank, html alone leaves it uneditable.
// The pair lives on disk (generated by scripts/make-designs.mjs); `_ws`/`_slug`
// say which one to read.
function emailVariantContent(c) {
  const dir = new URL(`../suprsend/templates/${c._ws}/${c._slug}/email/default/`, import.meta.url);
  return {
    templating_language: "handlebars",
    subject: c.subject,
    body: {
      type: "designer",
      designer: {
        html: readFileSync(new URL("body.designer.html", dir), "utf8"),
        design_json: JSON.parse(readFileSync(new URL("body.designer.json", dir), "utf8")),
        text: "",
        merge_tags: [],
        display_conditions: [],
      },
    },
  };
}
function inboxVariantContent(c) {
  return {
    templating_language: "handlebars", schema_version: "1.0", header: c.title, body: c.body,
    action_url: "", open_in_new_tab: false, image_url: "", subtext: null, importance: "default",
    avatar: null, tags: [], is_expiry_enabled: false, expiry: null, is_pinned: false,
    buttons: c.button ? [{ text: c.button.text, url: c.button.url, open_in_new_tab: true }] : [],
    extra_data: "",
  };
}
function refToJsonnet(ref) {
  const segs = ref.trim().split(".");
  const first = segs[0];
  const head = first.startsWith("$") ? `data[${JSON.stringify(first)}]` : `data.${first}`;
  return head + segs.slice(1).map((s) => `.${s}`).join("");
}
function strToJsonnet(s) {
  if (!/\{\{/.test(s)) return JSON.stringify(s);
  const re = /\{\{\{?\s*([\w$][\w$.]*)\s*\}?\}\}/g;
  const parts = [];
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(JSON.stringify(s.slice(last, m.index)));
    parts.push(refToJsonnet(m[1]));
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push(JSON.stringify(s.slice(last)));
  return parts.length ? parts.join(" + ") : '""';
}
function toJsonnet(v) {
  if (typeof v === "string") return strToJsonnet(v);
  if (Array.isArray(v)) return `[${v.map(toJsonnet).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).map(([k, val]) => `${JSON.stringify(k)}:${toJsonnet(val)}`).join(",")}}`;
  return JSON.stringify(v);
}
function slackVariantContent(c) {
  return { templating_language: "handlebars", body_type: "block", body_text: "", body_block: toJsonnet({ blocks: c.blocks }) };
}
const TEMPLATE_CHANNELS = ["email", "inbox", "sms", "whatsapp", "slack"];
const CHANNEL_CONTENT = {
  email: (d) => (d.email ? emailVariantContent(d.email) : null),
  inbox: (d) => (d.inbox ? inboxVariantContent(d.inbox) : null),
  sms: null, // not exercised by the seed data — no live template uses it (see README)
  whatsapp: null, // not exercised by the seed data — no live template uses it (see README)
  slack: (d) => (d.slack && d.slack.blocks?.length ? slackVariantContent(d.slack) : null),
};

// The distinct_id the editor preview renders against. It must be a real user in
// the workspace — `provision.mjs users` creates it.
const PREVIEW_RECIPIENT = "preview-user";

// Preview/test payload. `payload` alone is not enough: without an explicit
// recipient the preview has no $recipient object, so every {{$recipient.*}} in
// the template reports «"name" not defined in [object Object]». Naming a real
// recipient + tenant is what makes {{$recipient.name}} and {{$brand.*}} resolve.
async function setMockData(ws, slug, sample) {
  const data = {
    payload: sample && Object.keys(sample).length ? sample : {},
    recipient_distinct_id: PREVIEW_RECIPIENT,
    recipient_sub_type: "user",
    tenant_id: "default",
  };
  await call(ws, "v2", `template/${slug}/mock_data/`, { method: "PATCH", body: JSON.stringify({ data }) }).catch(() => {});
}

/** Publish one template: metadata → each channel's variant → sample data → commit. */
async function publishTemplate(ws, draft) {
  const channels = TEMPLATE_CHANNELS.filter((ch) => CHANNEL_CONTENT[ch] && CHANNEL_CONTENT[ch](draft) !== null);
  if (channels.length === 0) return { ok: false, status: 400, body: { error: "template has no supported channels" } };

  const meta = await call(ws, "v2", `template/${draft.slug}/`, {
    method: "POST",
    body: JSON.stringify({ name: draft.name, description: draft.description ?? "", tags: ["workvibe"], enabled_channels: channels }),
  });
  if (!meta.ok) return meta;

  for (const ch of channels) {
    const content = CHANNEL_CONTENT[ch](draft);
    const v = await call(ws, "v2", `template/${draft.slug}/channel/${ch}/variant/default/`, {
      method: "POST",
      body: JSON.stringify({ channel: ch, id: "default", tenant_id: null, locale: "en", conditions: [], content }),
    });
    if (!v.ok) return v;
  }

  await setMockData(ws, draft.slug, draft.sampleData);

  const committed = await call(ws, "v2", `template/${draft.slug}/commit/?commit_message=${encodeURIComponent("Seeded by provision.mjs")}`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
  return isNoChanges(committed) ? { ok: true, status: 200, body: { status: "active" } } : committed;
}

/** Publish one workspace's preference-category tree (must run before `workflows` —
 *  a workflow's `category` field is validated against these slugs at creation time). */
async function publishCategories(ws, rootCategories) {
  const r = await call(ws, "v1", `preference_category/?commit=true&commit_message=${encodeURIComponent("Seeded by provision.mjs")}`, {
    method: "POST",
    body: JSON.stringify({ root_categories: rootCategories }),
  });
  return isNoChanges(r) ? { ok: true, status: 200, body: { status: "active" } } : r;
}

// ── Stage: categories ──────────────────────────────────────────────────────────
async function cmdCategories() {
  const data = readJson("seed-data/categories.json");
  for (const [ws, rootCategories] of Object.entries(data)) {
    if (ws.startsWith("_")) continue;
    console.log(`\n=== ${ws} ===`);
    const r = await publishCategories(ws, rootCategories);
    console.log(`  ${r.ok ? "✓" : "✗"} preference categories HTTP ${r.status}${r.ok ? "" : " " + JSON.stringify(r.body).slice(0, 200)}`);
  }
}

// ── Stage: templates ───────────────────────────────────────────────────────────
async function cmdTemplates() {
  const data = readJson("seed-data/templates.json");
  for (const [ws, templates] of Object.entries(data)) {
    if (ws.startsWith("_")) continue;
    console.log(`\n=== ${ws} ===`);
    for (const t of templates) {
      const email = t.channels?.includes("email") ? { subject: t.subject, _ws: ws, _slug: t.slug } : null;
      const inbox = t.inbox ? { ...t.inbox, button: t.button } : null;
      const draft = { slug: t.slug, name: t.name, description: t.description, email, inbox, slack: t.slack, sampleData: t.sampleData };
      const r = await publishTemplate(ws, draft);
      console.log(`  ${r.ok ? "✓" : "✗"} ${t.slug.padEnd(28)} HTTP ${r.status}${r.ok ? "" : " " + JSON.stringify(r.body).slice(0, 200)}`);
    }
  }
}

// ── Workflow publish (ported verbatim: fills ref/schema_version/is_enabled the
//    same way the app's own publishWorkflow does, since the seed JSON omits them
//    for readability) ─────────────────────────────────────────────────────────
let refCounter = 0;
function ensureNodeRefs(nodes) {
  for (const n of nodes) {
    if (!n.ref) n.ref = `n_${++refCounter}`;
    if (!n.schema_version) n.schema_version = "1";
    if (!n.properties) n.properties = {};
    if (Array.isArray(n.branches)) {
      for (const b of n.branches) {
        if (!b.ref) b.ref = `b_${++refCounter}`;
        if (Array.isArray(b.nodes)) ensureNodeRefs(b.nodes);
      }
    }
  }
}
function normalizeWorkflow(workflow) {
  const w = JSON.parse(JSON.stringify(workflow));
  if (w.is_enabled === undefined) w.is_enabled = true;
  if (w.tree?.nodes) { refCounter = 0; ensureNodeRefs(w.tree.nodes); }
  return w;
}

async function publishWorkflow(ws, slug, workflow) {
  const r = await call(ws, "v1", `workflow/${slug}/?commit=true&commit_message=${encodeURIComponent("Seeded by provision.mjs")}`, {
    method: "POST",
    body: JSON.stringify(normalizeWorkflow(workflow)),
  });
  return isNoChanges(r) ? { ok: true, status: 200, body: { status: "active" } } : r;
}

// ── Stage: workflows ───────────────────────────────────────────────────────────
async function cmdWorkflows() {
  const data = readJson("seed-data/workflows.json");
  for (const [ws, workflows] of Object.entries(data)) {
    if (ws.startsWith("_")) continue; // skip the "_comment" key
    console.log(`\n=== ${ws} ===`);
    for (const wf of workflows) {
      const r = await publishWorkflow(ws, wf.slug, wf);
      console.log(`  ${r.ok ? "✓" : "✗"} ${wf.slug.padEnd(22)} HTTP ${r.status}${r.ok ? "" : " " + JSON.stringify(r.body).slice(0, 200)}`);
    }
  }
}

// ── Command ──────────────────────────────────────────────────────────────────
// ── Stage: users ──────────────────────────────────────────────────────────────
// Creates the preview recipient every template's mock_data points at. Without a
// real user behind that distinct_id the editor preview has no $recipient, and
// each template shows «"name" not defined in [object Object]».
//
// This is the one stage that talks to the hub rather than the Management API —
// user ingestion is SDK-only, so it needs the per-workspace WORKSPACE_KEY/SECRET
// (the Service Token alone can't do it).
async function cmdUsers() {
  const { Suprsend } = await import("@suprsend/node-sdk");
  for (const { slug } of readWorkspaces()) {
    const p = envPrefix(slug);
    const key = process.env[`${p}_WORKSPACE_KEY`];
    const secret = process.env[`${p}_WORKSPACE_SECRET`];
    console.log(`\n=== ${slug} ===`);
    if (!key || !secret) {
      console.log(`  ✗ ${p}_WORKSPACE_KEY / _WORKSPACE_SECRET not set — paste them from the dashboard first`);
      continue;
    }
    try {
      const client = new Suprsend(key, secret);
      const edit = client.users.get_edit_instance(PREVIEW_RECIPIENT);
      edit.add_email("preview@example.com");
      edit.set({ name: "Sam Rivera" });
      await client.users.edit(edit);
      console.log(`  ✓ ${PREVIEW_RECIPIENT} (Sam Rivera) — template previews will resolve {{$recipient.*}}`);
    } catch (e) {
      console.log(`  ✗ ${PREVIEW_RECIPIENT}: ${e?.message ?? e}`);
    }
  }
}

async function main() {
  if (!TOKEN) die("SUPRSEND_SERVICE_TOKEN is not set (run with --env-file=.env.local).");
  const stage = process.argv[2];
  if (stage === "workspaces") await cmdWorkspaces();
  else if (stage === "categories") await cmdCategories();
  else if (stage === "templates") await cmdTemplates();
  else if (stage === "workflows") await cmdWorkflows();
  else if (stage === "users") await cmdUsers();
  else if (stage === "all") { await cmdWorkspaces(); await cmdCategories(); await cmdTemplates(); await cmdWorkflows(); await cmdUsers(); }
  else {
    console.log("Usage: node --env-file=.env.local scripts/provision.mjs <workspaces|categories|templates|workflows|users|all>");
    process.exit(stage ? 1 : 0);
  }
}

await main();

// Fire a seeded workflow against a real subscriber, to test end to end.
//
//   node --env-file=.env.local scripts/fire-test.mjs <workspace> <workflow-slug> [distinct_id]
//
// Event-triggered workflows are fired by emitting their event; API-triggered ones
// by naming the workflow directly. This picks the right path from the workflow's
// CLI-native file (suprsend/<ws>/workflows/<slug>/workflow.json), and sends the
// template's own sample data (each template's mock_data.json) so nothing renders
// blank.

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url));
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };

const [ws, slug, whoArg] = process.argv.slice(2);
if (!ws || !slug) die("usage: fire-test.mjs <workspace> <workflow-slug> [distinct_id]");

// Default to the workspace's first seeded subscriber rather than a fixed id, so
// this keeps working when the roster changes.
const who = whoArg || (JSON.parse(readFileSync(resolve(HERE, "seed-data/users.json"), "utf8"))[ws] || [])[0]?.distinct_id;
if (!who) die(`no subscriber to send to — pass a distinct_id, or seed users for ${ws}`);

const wfPath = resolve(HERE, `../suprsend/${ws}/workflows/${slug}/workflow.json`);
let wf;
try {
  wf = JSON.parse(readFileSync(wfPath, "utf8"));
} catch {
  die(`no workflow file at ${wfPath} — is the slug right, and pulled for this workspace?`);
}

// Merge the sample data of every template this workflow sends (each template's
// mock_data.json `payload`, as pulled by the CLI).
const slugs = (wf.tree?.nodes ?? []).map((n) => n.properties?.template).filter(Boolean);
const data = Object.assign(
  {},
  ...slugs.map((s) => {
    try {
      return JSON.parse(readFileSync(resolve(HERE, `../suprsend/${ws}/templates/${s}/mock_data.json`), "utf8")).payload ?? {};
    } catch {
      return {};
    }
  }),
);

const p = `SUPRSEND_${ws.replace(/-/g, "_").toUpperCase()}`;
const key = process.env[`${p}_WORKSPACE_KEY`], secret = process.env[`${p}_WORKSPACE_SECRET`];
if (!key || !secret) die(`${p}_WORKSPACE_KEY / _WORKSPACE_SECRET not set`);

const { Suprsend, Event: SuprsendEvent, WorkflowTriggerRequest } = await import("@suprsend/node-sdk");
const c = new Suprsend(key, secret);

if (wf.trigger_type === "event") {
  // Authored uppercase in trigger_events, but SuprSend matches on the lowercase name it
  // ingests. Emitting the uppercase form is accepted with a 202 and then silently
  // matches nothing, so lowercase it here.
  const ev = ((wf.trigger_events ?? [])[0] ?? "").toLowerCase();
  if (!ev) die(`${slug} is event-triggered but names no event`);
  console.log(`→ ${ws}: emitting ${ev} for ${who}`);
  console.log(await c.track_event(new SuprsendEvent(who, ev, data, { tenant_id: "default" })));
} else {
  console.log(`→ ${ws}: triggering workflow ${slug} for ${who}`);
  console.log(await c.workflows.trigger(new WorkflowTriggerRequest({
    workflow: slug, recipients: [{ distinct_id: who }], tenant_id: "default", data,
  })));
}
console.log(`\nCheck: app.suprsend.com/en/${ws}/logs`);

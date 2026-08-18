// Pull a template's email design out of SuprSend into the repo.
//
//   node --env-file=.env.local scripts/pull-design.mjs <workspace> <template-slug> [--as <local-slug>]
//
// Writes the visual-designer pair that `provision.mjs` pushes back:
//   suprsend/templates/<local-slug>/email/default/body.designer.html   (rendered + sent)
//   suprsend/templates/<local-slug>/email/default/body.designer.json   (editor canvas tree)
//
// Both are needed. design_json alone leaves the canvas blank; html alone leaves it
// uneditable. Designs are brand-agnostic — `brand_block` resolves {{$brand.*}} from
// whichever tenant renders it — so a design built in any workspace ports unchanged.
//
// Read-only: a single GET. Never writes to SuprSend.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MGMNT = (process.env.SUPRSEND_MGMNT_URL || "https://management-api.suprsend.com").replace(/\/+$/, "");
const TOKEN = process.env.SUPRSEND_SERVICE_TOKEN;

const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };

const argv = process.argv.slice(2);
const asIdx = argv.indexOf("--as");
const localSlug = asIdx > -1 ? argv[asIdx + 1] : null;
const [ws, slug] = argv.filter((_, i) => asIdx === -1 || (i !== asIdx && i !== asIdx + 1));

if (!TOKEN) die("SUPRSEND_SERVICE_TOKEN is not set (run with --env-file=.env.local)");
if (!ws || !slug) die("usage: pull-design.mjs <workspace> <template-slug> [--as <local-slug>]");

const url = `${MGMNT}/v2/${ws}/template/${slug}/channel/email/variant/default/`;
const res = await fetch(url, {
  headers: { Authorization: `ServiceToken ${TOKEN}`, "Content-Type": "application/json" },
  cache: "no-store",
});
if (!res.ok) die(`GET ${res.status} ${url}\n  ${(await res.text()).slice(0, 300)}`);

const body = (await res.json())?.content?.body;
if (!body) die("no content.body on the response — is there an email variant?");
if (body.type !== "designer") {
  die(`variant is "${body.type}" mode, not "designer" — rebuild it in the Visual Designer, not the HTML editor`);
}

const html = body.designer?.html;
const json = body.designer?.design_json;
if (!html) die("designer.html is empty");
if (!json) die("designer.design_json is empty — the canvas tree did not come back");

const outDir = resolve(ROOT, `suprsend/templates/${localSlug || slug}/email/default`);
mkdirSync(outDir, { recursive: true });
writeFileSync(resolve(outDir, "body.designer.html"), html);
writeFileSync(resolve(outDir, "body.designer.json"), JSON.stringify(json, null, 1));

const vars = [...new Set([...html.matchAll(/\{\{\{?\s*#?\s*(?:if\s+)?([\w$][\w$.]*)/g)].map((m) => m[1]))].sort();
console.log(`✓ ${ws}/${slug} → suprsend/templates/${localSlug || slug}/email/default/`);
console.log(`  body.designer.html  ${html.length.toLocaleString()} bytes`);
console.log(`  body.designer.json  ${JSON.stringify(json).length.toLocaleString()} bytes`);
console.log(`\n  variables referenced:\n${vars.map((v) => `    {{${v}}}`).join("\n")}`);

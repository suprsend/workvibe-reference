// Generate every template's visual-designer pair from one base design.
//
//   node scripts/make-designs.mjs
//
// The base is suprsend/templates/ride-credit-offer/email/default/ — pulled out of
// SuprSend with scripts/pull-design.mjs. Every other template is that design with
// three strings swapped: the heading, the paragraph, and the button label (taken
// from `heading` / `paragraph` / `button` in seed-data/templates.json).
//
// Why a generator instead of 12 hand-built designs: only two blocks in the design
// carry copy. Everything else is `brand_block`, which resolves {{$brand.*}} from
// whichever tenant renders it — so one design serves every workspace, and the
// copy is the only thing worth version-controlling per template.
//
// The same string appears verbatim in BOTH files (design_json `values.text` is the
// html's inner markup), so one literal replace keeps the pair consistent. That is
// load-bearing: design_json alone leaves the editor canvas blank, html alone
// leaves it uneditable.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = resolve(ROOT, "suprsend/templates/ride-credit-offer/email/default");
const die = (m) => { console.error(`✗ ${m}`); process.exit(1); };

const baseHtml = readFileSync(resolve(BASE, "body.designer.html"), "utf8");
const baseJsonRaw = readFileSync(resolve(BASE, "body.designer.json"), "utf8");
const baseJson = JSON.parse(baseJsonRaw);

// Locate the two copy blocks in the base tree, and the button block's label.
let baseHeading, baseParagraph, baseButton, baseHref;
for (const row of baseJson.body.rows) {
  for (const col of row.columns ?? []) {
    for (const c of col.contents ?? []) {
      const v = c.values ?? {};
      if (c.type === "heading" && typeof v.text === "string") baseHeading = v.text;
      if (c.type === "paragraph" && typeof v.text === "string") baseParagraph = v.text;
      if (c.slug === "brand_block" && v.blockType === "brand_button" && v.buttonText) {
        baseButton = v.buttonText;
        // The button's link lives separately from its label. Swapping only the label
        // leaves every cloned design pointing at the base's {{cta_url}} — which only the
        // base template supplies, so email rendering fails with "missing variables".
        baseHref = v.actionType?.values?.href;
      }
    }
  }
}
if (!baseHeading) die("no heading block in the base design");
if (!baseParagraph) die("no paragraph block in the base design");
if (!baseButton) die("no brand_button block in the base design");
if (!baseHref) die("no button href in the base design");

// Rebuild the base's markup shape around new copy, so the swap is a like-for-like
// string replace in both files.
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/'/g, "&#39;");
const headingMarkup = (text) => `<span><span>${esc(text)}</span></span>`;
const paragraphMarkup = (text) =>
  text
    .split(/\n+/)
    .map((line) => `<p style="margin: 0px; margin-block: 0px;"><span>${esc(line.trim())}</span></p>`)
    .join("");

// The base heading/paragraph carry {{handlebars}} that esc() would mangle on the
// way back in; unescape the brace runs so variables survive.
const unescapeVars = (s) => s.replace(/\{\{[^}]*\}\}/g, (m) => m.replace(/&#39;/g, "'").replace(/&amp;/g, "&"));

const templates = JSON.parse(readFileSync(resolve(ROOT, "scripts/seed-data/templates.json"), "utf8"));

let written = 0;
for (const [ws, list] of Object.entries(templates)) {
  if (ws.startsWith("_")) continue;
  for (const t of list) {
    if (!t.channels?.includes("email")) continue;
    if (!t.heading || !t.paragraph) die(`${ws}/${t.slug}: missing heading or paragraph`);

    const newHeading = unescapeVars(headingMarkup(t.heading));
    const newParagraph = unescapeVars(paragraphMarkup(t.paragraph));
    const newButton = t.button?.text ?? baseButton;
    const newHref = t.button?.url ?? baseHref;

    let html = baseHtml;
    let json = baseJsonRaw;
    for (const [from, to] of [
      [baseHeading, newHeading],
      [baseParagraph, newParagraph],
      [baseButton, newButton],
      [baseHref, newHref],
    ]) {
      const jsonFrom = JSON.stringify(from).slice(1, -1);
      const jsonTo = JSON.stringify(to).slice(1, -1);
      if (!html.includes(from) && from !== baseButton) die(`base html missing expected block for ${t.slug}`);
      html = html.split(from).join(to);
      json = json.split(jsonFrom).join(jsonTo);
    }

    JSON.parse(json); // fail loudly rather than write a corrupt tree

    const dir = resolve(ROOT, `suprsend/templates/${ws}/${t.slug}/email/default`);
    mkdirSync(dir, { recursive: true });
    writeFileSync(resolve(dir, "body.designer.html"), html);
    writeFileSync(resolve(dir, "body.designer.json"), json);
    written++;
    console.log(`  ✓ ${ws}/${t.slug}`);
  }
}
console.log(`\n${written} designs generated from ${"ride-credit-offer"}.`);

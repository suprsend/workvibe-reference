// Publish the reference assets with the official SuprSend CLI.
//
//   node --env-file=.env.local scripts/push-assets.mjs             # push + commit live
//   node --env-file=.env.local scripts/push-assets.mjs --dry-run   # preview only
//   node --env-file=.env.local scripts/push-assets.mjs workvibe-emberoak   # one workspace
//
// The assets live as CLI-native files under suprsend/<workspace>/ — the same
// files `npx suprsend … pull` writes, so dashboard edits can be pulled back over
// them. Per workspace, in dependency order:
//
//   1. preference categories   (workflows validate their `category` against these)
//   2. templates               (workflows reference them by slug)
//   3. workflows
//
// Pushes are committed straight to live (`--commit`): the kit is the app's
// working state, not a review queue. Re-runs are safe — an unchanged asset
// commits as a no-op. Needs only SUPRSEND_SERVICE_TOKEN; the CLI reads it from
// the environment.
//
// One thing the CLI cannot do rides along here: categories that deliver on the
// inbox channel also need the workspace-level "show inbox in the preference
// centre" flag. Without it, hub returns email-only preferences for every
// subscriber — silently — even for categories that default to inbox. The flag
// is set right after each category push.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const MGMNT = (process.env.SUPRSEND_MGMNT_URL || "https://management-api.suprsend.com").replace(/\/+$/, "");
const TOKEN = process.env.SUPRSEND_SERVICE_TOKEN;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const only = args.find((a) => !a.startsWith("--"));

function die(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// One folder per workspace under suprsend/, named by its slug.
function readWorkspaceSlugs() {
  return readdirSync(resolve(ROOT, "suprsend"), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}

function run(cliArgs) {
  const shown = `npx suprsend ${cliArgs.join(" ")}`;
  console.log(`\n$ ${shown}`);
  const r = spawnSync("npx", ["suprsend", ...cliArgs], { stdio: "inherit", cwd: ROOT });
  if (r.status !== 0) die(`command failed (exit ${r.status ?? "?"}): ${shown}`);
}

// Workspace-level flag; see the header. PATCH /v1/workspace/{ws}/config/ — note
// the path shape differs from every other management endpoint (/v1/{ws}/…).
async function enableInboxPreferences(ws) {
  const res = await fetch(`${MGMNT}/v1/workspace/${ws}/config/`, {
    method: "PATCH",
    headers: { Authorization: `ServiceToken ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ user_inbox_preference_enabled: true }),
  });
  console.log(`  ${res.ok ? "✓" : "✗"} inbox shown in preference centre HTTP ${res.status}`);
}

async function main() {
  if (!TOKEN) die("SUPRSEND_SERVICE_TOKEN is not set (run with --env-file=.env.local).");

  const slugs = readWorkspaceSlugs().filter((s) => !only || s === only);
  if (slugs.length === 0) die(only ? `no assets folder for "${only}" under suprsend/` : "no workspace folders under suprsend/");

  for (const ws of slugs) {
    console.log(`\n════ ${ws} ════`);
    const base = resolve(ROOT, "suprsend", ws);
    if (!existsSync(base)) {
      console.log(`  – no assets folder (suprsend/${ws}/) — skipped`);
      continue;
    }

    const stages = [
      ["category", "preference_categories"],
      ["template", "templates"],
      ["workflow", "workflows"],
    ];
    for (const [kind, dir] of stages) {
      const path = resolve(base, dir);
      if (!existsSync(path)) {
        console.log(`  – no ${dir}/ — skipped`);
        continue;
      }
      // -F is required to run non-interactively: without it the CLI waits on a
      // confirmation prompt (verified — it hangs with no TTY). For templates it
      // ALSO means "skip variants with errors", so read the per-variant warnings
      // in the output; a real error is skipped rather than failing the run.
      const cliArgs = [kind, "push", "-w", ws, "-d", `suprsend/${ws}/${dir}`];
      cliArgs.push(dryRun ? "--dry-run" : "--commit", ...(dryRun ? [] : ["-F", "--commit-message", "Pushed by push-assets.mjs"]));
      run(cliArgs);

      if (kind === "category" && !dryRun && readFileSync(resolve(path, "categories.json"), "utf8").includes('"inbox"')) {
        await enableInboxPreferences(ws);
      }
    }
  }
  console.log(dryRun ? "\nDry run complete — nothing was pushed." : "\nDone.");
}

await main();

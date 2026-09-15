import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";

// The B2B2C premise this app demonstrates: every customer of the platform is in
// the same business, so the core assets are STANDARD — the same five workflows,
// their templates and four categories in every workspace — and each customer
// differs only by one or two additions. These tests pin the standard set to
// deep equality so a copy tweak in one workspace can't silently fork it.
//
// The assets are the CLI-native files under suprsend/<workspace>/ (what
// `npx suprsend … pull` writes and `npm run push:assets` publishes). Pulled
// files carry server-stamped fields (timestamps, hash, updated_by, …) that
// legitimately differ per workspace — those are stripped before comparing.

const ROOT = resolve(__dirname, "..");
// Every workspace folder in the kit — the same folders `push:assets` publishes.
const WORKSPACES = readdirSync(resolve(ROOT, "suprsend"), { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);
const DEFAULT_WORKFLOWS = ["welcome-diner", "order-confirmed", "order-ready", "order-receipt", "sign-in-alert"];
const DEFAULT_CATEGORIES = ["getting-started", "order-updates", "receipts", "account-security"];

type Json = Record<string, unknown>;

function readJson(rel: string): Json | undefined {
  try {
    return JSON.parse(readFileSync(resolve(ROOT, rel), "utf8"));
  } catch {
    return undefined;
  }
}

// Fields the server stamps on pull — different per workspace by construction.
const VOLATILE = new Set([
  "active_at",
  "created_at",
  "updated_at",
  "last_executed_at",
  "hash",
  "commit_message",
  "updated_by",
  "validation_result",
  "status",
]);

function stable(doc: Json | undefined): Json | undefined {
  if (!doc) return undefined;
  return Object.fromEntries(Object.entries(doc).filter(([k]) => !VOLATILE.has(k)));
}

function workflow(ws: string, slug: string) {
  return stable(readJson(`suprsend/${ws}/workflows/${slug}/workflow.json`));
}

function categoryBySlug(ws: string, slug: string): Json | undefined {
  const doc = readJson(`suprsend/${ws}/preference_categories/categories.json`);
  const roots = (doc?.root_categories ?? []) as { sections?: { categories?: (Json & { category: string })[] }[] }[];
  for (const root of roots) {
    for (const section of root.sections ?? []) {
      const hit = (section.categories ?? []).find((c) => c.category === slug);
      if (hit) return hit;
    }
  }
  return undefined;
}

function expectSameEverywhere(docs: (Json | undefined)[]) {
  const [first, ...rest] = docs;
  expect(first).toBeDefined();
  for (const doc of rest) expect(doc).toStrictEqual(first);
}

describe("the default set is identical in every workspace", () => {
  it("the kit has more than one workspace to compare", () => {
    expect(WORKSPACES.length).toBeGreaterThan(1);
  });

  it.each(DEFAULT_WORKFLOWS)("workflow %s", (slug) => {
    expectSameEverywhere(WORKSPACES.map((ws) => workflow(ws, slug)));
  });

  it.each(DEFAULT_WORKFLOWS)("template metadata for %s", (slug) => {
    // The standard workflows send a template of the same slug.
    expectSameEverywhere(WORKSPACES.map((ws) => readJson(`suprsend/${ws}/templates/${slug}/template.json`)));
  });

  it.each(DEFAULT_CATEGORIES)("category %s", (slug) => {
    expectSameEverywhere(WORKSPACES.map((ws) => categoryBySlug(ws, slug)));
  });
});

// The kit ships no users, so a preview can't point at one — a pushed id would name
// someone who doesn't exist in a fresh workspace. The app's editor picks a live user.
describe("template previews name no recipient", () => {
  it.each(WORKSPACES)("%s", (ws) => {
    for (const slug of readdirSync(resolve(ROOT, `suprsend/${ws}/templates`))) {
      const mock = readJson(`suprsend/${ws}/templates/${slug}/mock_data.json`);
      if (mock) expect(mock.recipient_distinct_id, `${ws}/${slug}`).toBeNull();
    }
  });
});

describe("every workflow's templates ship with it", () => {
  it.each(WORKSPACES)("%s", (ws) => {
    const wfDir = resolve(ROOT, `suprsend/${ws}/workflows`);
    for (const slug of readdirSync(wfDir)) {
      const doc = readJson(`suprsend/${ws}/workflows/${slug}/workflow.json`);
      const nodes = ((doc?.tree as Json | undefined)?.nodes ?? []) as { properties?: { template?: string } }[];
      for (const n of nodes) {
        const t = n.properties?.template;
        if (t) expect(readJson(`suprsend/${ws}/templates/${t}/template.json`), `${ws}/${slug} → ${t}`).toBeDefined();
      }
    }
  });
});

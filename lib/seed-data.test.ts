import { describe, it, expect } from "vitest";
import workflowSeed from "@/scripts/seed-data/workflows.json";
import templateSeed from "@/scripts/seed-data/templates.json";
import categorySeed from "@/scripts/seed-data/categories.json";

// The B2B2C premise this app demonstrates: every customer of the platform is in
// the same business, so the core assets are STANDARD — the same five workflows,
// their templates and four categories in every workspace — and each customer
// differs only by one or two additions. These tests pin the standard set to
// deep equality so a copy tweak in one workspace can't silently fork it.

const WORKSPACES = ["workvibe-emberoak", "workvibe-nolans"] as const;
const DEFAULT_WORKFLOWS = ["welcome-diner", "order-confirmed", "order-ready", "order-receipt", "sign-in-alert"];
const DEFAULT_CATEGORIES = ["getting-started", "order-updates", "receipts", "account-security"];

type Seed = Record<string, unknown>;
const workflows = workflowSeed as unknown as Record<string, (Seed & { slug: string })[]>;
const templates = templateSeed as unknown as Record<string, (Seed & { slug: string })[]>;
const categories = categorySeed as unknown as Record<
  string,
  { sections?: { categories?: (Seed & { category: string })[] }[] }[]
>;

const bySlug = (list: { slug: string }[] | undefined, slug: string) => list?.find((x) => x.slug === slug);

function categoryBySlug(ws: string, slug: string) {
  for (const root of categories[ws] ?? []) {
    for (const section of root.sections ?? []) {
      const hit = (section.categories ?? []).find((c) => c.category === slug);
      if (hit) return hit;
    }
  }
  return undefined;
}

describe("the default set is identical in every workspace", () => {
  it.each(DEFAULT_WORKFLOWS)("workflow %s", (slug) => {
    const [a, b] = WORKSPACES.map((ws) => bySlug(workflows[ws], slug));
    expect(a).toBeDefined();
    expect(b).toStrictEqual(a);
  });

  it.each(DEFAULT_WORKFLOWS)("template %s", (slug) => {
    const [a, b] = WORKSPACES.map((ws) => bySlug(templates[ws], slug));
    expect(a).toBeDefined();
    expect(b).toStrictEqual(a);
  });

  it.each(DEFAULT_CATEGORIES)("category %s", (slug) => {
    const [a, b] = WORKSPACES.map((ws) => categoryBySlug(ws, slug));
    expect(a).toBeDefined();
    expect(b).toStrictEqual(a);
  });
});

describe("per-customer additions", () => {
  it("Ember & Oak adds order-feedback and the feedback category", () => {
    expect(bySlug(workflows["workvibe-emberoak"], "order-feedback")).toBeDefined();
    expect(categoryBySlug("workvibe-emberoak", "feedback")).toBeDefined();
    expect(bySlug(workflows["workvibe-nolans"], "order-feedback")).toBeUndefined();
  });

  it("Nolan's adds arriving-soon, offers, and the weekend-deal broadcast", () => {
    expect(bySlug(workflows["workvibe-nolans"], "arriving-soon")).toBeDefined();
    expect(categoryBySlug("workvibe-nolans", "offers")).toBeDefined();
    expect(bySlug(templates["workvibe-nolans"], "weekend-deal")).toMatchObject({ broadcastCategory: "offers" });
    expect(bySlug(workflows["workvibe-emberoak"], "arriving-soon")).toBeUndefined();
  });
});

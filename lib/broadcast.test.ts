import { describe, it, expect } from "vitest";
import { findCategory, toBroadcastTemplates } from "@/lib/broadcast";

const PROMOTIONAL = [
  { category: "offers", name: "Offers" },
  { category: "seasonal-menus", name: "Seasonal menus" },
];

describe("findCategory", () => {
  it("returns the picked category when it is in the live promotional tree", () => {
    expect(findCategory("offers", PROMOTIONAL)?.name).toBe("Offers");
  });

  // A rename drifts the slug (SuprSend derives it from the name). Blocking is the
  // point: substituting another promotional category would send the message to
  // subscribers who opted out of this kind of message.
  it("returns null when the picked slug is no longer in the live tree", () => {
    expect(findCategory("weekend-offers", PROMOTIONAL)).toBeNull();
  });

  it("never substitutes a different category", () => {
    expect(findCategory("gone", PROMOTIONAL)).not.toBe(PROMOTIONAL[0]);
  });

  it("returns null with no pick", () => {
    expect(findCategory("", PROMOTIONAL)).toBeNull();
    expect(findCategory(null, PROMOTIONAL)).toBeNull();
  });
});

describe("toBroadcastTemplates", () => {
  it("offers every live template that can deliver on at least one channel", () => {
    const out = toBroadcastTemplates([
      { slug: "seasonal-menu", name: "Seasonal menu", description: "New dishes", enabled_channels: ["email"] },
      { slug: "dashboard-made", name: "Made in the dashboard", enabled_channels: ["email", "inbox"] },
    ]);
    expect(out.map((t) => t.slug)).toEqual(["seasonal-menu", "dashboard-made"]);
    expect(out[1].description).toBe("");
  });

  it("filters out a template with no enabled channel — it would deliver to nobody", () => {
    const out = toBroadcastTemplates([
      { slug: "empty", name: "Empty", enabled_channels: [] },
      { slug: "none", name: "None" },
    ]);
    expect(out).toEqual([]);
  });
});

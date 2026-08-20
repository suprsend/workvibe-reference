import { describe, it, expect } from "vitest";
import { resolveBroadcastCategory, getBroadcastTemplates } from "@/lib/broadcast";

const PROMOTIONAL = [
  { category: "offers-and-promos", name: "Offers & promos" },
  { category: "local-updates", name: "Local updates" },
];

describe("resolveBroadcastCategory", () => {
  it("uses the category the template is registered under", () => {
    expect(resolveBroadcastCategory({ category: "offers-and-promos" }, PROMOTIONAL)?.name).toBe("Offers & promos");
  });

  // A rename drifts the slug (SuprSend derives it from the name). Blocking is the
  // point: substituting another promotional category would send the message to
  // subscribers who opted out of this kind of message.
  it("returns null when the registered category is no longer in the live tree", () => {
    expect(resolveBroadcastCategory({ category: "ride-offers" }, PROMOTIONAL)).toBeNull();
  });

  it("never substitutes a different category", () => {
    expect(resolveBroadcastCategory({ category: "gone" }, PROMOTIONAL)).not.toBe(PROMOTIONAL[0]);
  });

  it("returns null with no template", () => {
    expect(resolveBroadcastCategory(null, PROMOTIONAL)).toBeNull();
  });

  it("every seeded broadcast template resolves against its own workspace tree", () => {
    for (const ws of ["workvibe-loopride", "workvibe-northwind"] as const) {
      for (const t of getBroadcastTemplates(ws)) {
        expect(resolveBroadcastCategory(t, [{ category: t.category, name: t.category }])).not.toBeNull();
      }
    }
  });
});

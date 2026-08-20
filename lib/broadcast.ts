// The templates each workspace can broadcast.
//
// A broadcast targets a TEMPLATE, not a workflow — there is no journey, just one
// send fanned out across the all-subscribers list. SuprSend templates carry no
// category of their own (the category lives on the workflow that sends them), so
// a broadcast has to name one, and this registry is where the app records which
// template goes out under which category.
//
// Every entry is PROMOTIONAL on purpose: per SuprSend's docs a broadcast on a
// transactional or system category delays other traffic on those categories.
// The API route still checks the submitted category against the workspace's live
// promotional tree — this registry sets the default, not the guarantee.
import type { WorkspaceSlug } from "@/lib/workspaces";

export interface BroadcastTemplate {
  /** Template slug in SuprSend. */
  slug: string;
  /** Label for the picker. */
  name: string;
  /** What this broadcast is, in one line. */
  description: string;
  /** Promotional category it sends under by default. */
  category: string;
}

export const BROADCAST_TEMPLATES: Record<WorkspaceSlug, BroadcastTemplate[]> = {
  "workvibe-loopride": [
    {
      slug: "ride-credit-offer",
      name: "Ride credit offer",
      description: "Promo code and ride credit for the whole rider base.",
      category: "offers-and-promos",
    },
  ],
  "workvibe-northwind": [
    {
      slug: "product-announcement",
      name: "Product announcement",
      description: "New features, coverage and speed upgrades.",
      category: "product-news",
    },
  ],
};

export function getBroadcastTemplates(ws: WorkspaceSlug): BroadcastTemplate[] {
  return BROADCAST_TEMPLATES[ws] ?? [];
}

export function getBroadcastTemplate(ws: WorkspaceSlug, slug: string): BroadcastTemplate | null {
  return getBroadcastTemplates(ws).find((t) => t.slug === slug) ?? null;
}

/** A category as it exists in the workspace's live promotional tree. */
export interface LiveCategory {
  category: string;
  name: string;
}

/**
 * The category a broadcast sends under: the one its template is registered with,
 * and only if that category is still in the live PROMOTIONAL tree.
 *
 * The category decides whose opt-outs apply, so it is not a per-send choice —
 * sending a promo under an unrelated category would deliver it to people who
 * opted out of exactly that kind of message. Returns null rather than falling
 * back to another category: SuprSend derives a category's slug from its NAME, so
 * a rename drifts the registered slug out of the tree, and that has to surface
 * instead of silently sending under whatever else happens to be promotional.
 */
export function resolveBroadcastCategory<T extends LiveCategory>(
  template: { category: string } | null | undefined,
  promotional: T[],
): T | null {
  if (!template) return null;
  return promotional.find((c) => c.category === template.category) ?? null;
}

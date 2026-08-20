// Which templates this workspace can broadcast.
//
// A broadcast targets a TEMPLATE, not a workflow — there is no journey, just one
// send fanned out across the all-subscribers list. SuprSend templates carry no
// category of their own (a workflow names the category for the templates it
// sends), so a broadcast has to name one, and the seed records it per template as
// `broadcastCategory`. Declaring it is the whole of what makes a template
// broadcastable — there is no separate whitelist, and no platform restriction
// either: SuprSend will broadcast any template you name a category for.
//
// That category must be PROMOTIONAL: per SuprSend's docs a broadcast on a
// transactional or system category delays other traffic on those categories. The
// API route re-checks the submitted category against the workspace's live
// promotional tree, so the seed sets the pairing, not the guarantee.
import type { WorkspaceSlug } from "@/lib/workspaces";
import templates from "@/scripts/seed-data/templates.json";

export interface BroadcastTemplate {
  /** Template slug in SuprSend. */
  slug: string;
  /** Label for the picker. */
  name: string;
  /** What this broadcast is, in one line. */
  description: string;
  /** Promotional category it sends under. */
  category: string;
}

interface SeedTemplate {
  slug: string;
  name: string;
  description?: string;
  broadcastCategory?: string;
}

const BY_WORKSPACE = templates as unknown as Record<string, SeedTemplate[]>;

export function getBroadcastTemplates(ws: WorkspaceSlug): BroadcastTemplate[] {
  return (BY_WORKSPACE[ws] ?? [])
    .filter((t) => Boolean(t.broadcastCategory))
    .map((t) => ({
      slug: t.slug,
      name: t.name,
      description: t.description ?? "",
      category: t.broadcastCategory as string,
    }));
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
 * The category a broadcast sends under: the one its template declares, and only if
 * that category is still in the live PROMOTIONAL tree.
 *
 * The category decides whose opt-outs apply, so it is not a per-send choice —
 * sending a promo under an unrelated category would deliver it to people who
 * opted out of exactly that kind of message. Returns null rather than falling
 * back to another category: SuprSend derives a category's slug from its NAME, so
 * a rename drifts the declared slug out of the tree, and that has to surface
 * instead of silently sending under whatever else happens to be promotional.
 */
export function resolveBroadcastCategory<T extends LiveCategory>(
  template: { category: string } | null | undefined,
  promotional: T[],
): T | null {
  if (!template) return null;
  return promotional.find((c) => c.category === template.category) ?? null;
}

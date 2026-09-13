// Broadcast options, derived from the LIVE workspace — not from the seed files.
//
// A broadcast targets a TEMPLATE, not a workflow — there is no journey, just one
// send fanned out across the all-subscribers list. Any template in the account can
// be broadcast (SuprSend imposes no whitelist), so the picker offers the live
// template list; a template created in the SuprSend dashboard shows up here too.
//
// SuprSend templates carry no category of their own (a workflow names the category
// for the templates it sends), so a broadcast has to name one, and the sender
// picks it per broadcast — the same choice the SuprSend dashboard asks for. The
// category must be PROMOTIONAL: per SuprSend's docs a broadcast on a transactional
// or system category delays other traffic on those categories. The API route
// enforces that against the workspace's live promotional tree.
//
// The category decides whose opt-outs apply, so the form never preselects one —
// sending a promo under an unrelated category would deliver it to people who opted
// out of exactly that kind of message.
import type { TemplateSummary } from "@/lib/suprsend-mgmt";

export interface BroadcastTemplate {
  /** Template slug in SuprSend. */
  slug: string;
  /** Label for the picker. */
  name: string;
  /** What this broadcast is, in one line. */
  description: string;
}

/** A category as it exists in the workspace's live promotional tree. */
export interface LiveCategory {
  category: string;
  name: string;
}

/**
 * Shape the live template list into broadcast options. A template with no enabled
 * channel can't deliver anything, so offering it would only manufacture a
 * confusing "sent to nobody" — those are filtered out.
 */
export function toBroadcastTemplates(live: TemplateSummary[]): BroadcastTemplate[] {
  return live
    .filter((t) => (t.enabled_channels ?? []).length > 0)
    .map((t) => ({ slug: t.slug, name: t.name, description: t.description ?? "" }));
}

/**
 * The picked category, but only if it is really in the live PROMOTIONAL tree.
 * Returns null rather than falling back to another category: SuprSend derives a
 * category's slug from its NAME, so a rename drifts a remembered slug out of the
 * tree, and that has to surface instead of silently sending under whatever else
 * happens to be promotional.
 */
export function findCategory<T extends LiveCategory>(
  slug: string | null | undefined,
  promotional: T[],
): T | null {
  if (!slug) return null;
  return promotional.find((c) => c.category === slug) ?? null;
}

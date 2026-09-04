// WorkVibe workspace registry.
// One account-level Service Token covers every workspace (verified). The slug
// selects the workspace by URL path on the Management API; per-workspace public
// + signing keys (read by server routes from env) drive the frontend SDKs.
// Each customer = its own SuprSend workspace. Two accents max per workspace.

export type WorkspaceSlug = "workvibe-emberoak" | "workvibe-nolans";

export interface Workspace {
  slug: WorkspaceSlug;
  /** Short name shown in the switcher. */
  label: string;
  /** Full org name for headers / empty states. */
  fullName: string;
  /** Single-letter mark for the avatar tile. */
  initial: string;
  /** Brand accent → overrides --primary for this workspace. */
  accent: string;
  /** Foreground that reads on the accent. */
  accentForeground: string;
}

export const WORKSPACES: Workspace[] = [
  {
    slug: "workvibe-emberoak",
    label: "Ember & Oak",
    fullName: "Ember & Oak — Diner Communications",
    initial: "E",
    accent: "#9A3412",
    accentForeground: "#ffffff",
  },
  {
    slug: "workvibe-nolans",
    label: "Nolan's Pizza",
    fullName: "Nolan's Pizza — Diner Communications",
    initial: "N",
    accent: "#B91C1C",
    accentForeground: "#ffffff",
  },
];

export const DEFAULT_WORKSPACE: WorkspaceSlug = WORKSPACES[0].slug;

export function getWorkspace(slug?: string | null): Workspace {
  return WORKSPACES.find((w) => w.slug === slug) ?? WORKSPACES[0];
}

export function isWorkspaceSlug(value?: string | null): value is WorkspaceSlug {
  return WORKSPACES.some((w) => w.slug === value);
}

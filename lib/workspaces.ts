// WorkVibe workspace registry.
// One account-level Service Token covers every workspace (verified). The slug
// selects the workspace by URL path on the Management API; per-workspace public
// + signing keys (read by server routes from env) drive the frontend SDKs.
// Each customer = its own SuprSend workspace. Two accents max per workspace.

export type WorkspaceSlug = "workvibe-loopride" | "workvibe-northwind";

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
    slug: "workvibe-loopride",
    label: "Loopride",
    fullName: "Loopride — Rider Communications",
    initial: "L",
    accent: "#0E9F6E",
    accentForeground: "#ffffff",
  },
  {
    slug: "workvibe-northwind",
    label: "Northwind",
    fullName: "Northwind — Subscriber Communications",
    initial: "N",
    accent: "#1B4E8C",
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

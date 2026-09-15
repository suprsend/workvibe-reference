// Workspaces are read from the SuprSend account at runtime — none are declared here.
// This file holds the shapes and the pure rules (which workspaces the app can use,
// how a brand turns into a switcher tile), shared by server, client and tests.

export type WorkspaceSlug = string;

/** A workspace the app can act on: it exists in the account AND its keys are in env. */
export interface Workspace {
  slug: WorkspaceSlug;
  name: string;
}

/** A workspace as the switcher shows it. Name and colour come from its default brand. */
export interface WorkspaceView extends Workspace {
  initial: string;
  /** The brand's primary colour, or null when the brand sets none (the app theme applies). */
  accent: string | null;
  /** Text colour that reads on `accent`. */
  accentForeground: string | null;
}

/** One row of the Management API's workspace list. */
export interface AccountWorkspace {
  slug: string;
  name?: string;
  uid?: string;
}

export const NO_WORKSPACE_MESSAGE =
  "No workspace is connected. Run `npm run create:workspaces`, paste the keys into .env.local, then restart the dev server.";

/** Env-var prefix for a workspace's credentials. "workvibe-emberoak" → "SUPRSEND_WORKVIBE_EMBEROAK". */
export function envPrefix(slug: WorkspaceSlug): string {
  return `SUPRSEND_${slug.replace(/-/g, "_").toUpperCase()}`;
}

/**
 * The account's workspaces the app can use. One qualifies when the Workspace Key in
 * env equals its UID and its secret is set — so the match is on the key, not the
 * name, and every other workspace in the account stays hidden.
 */
export function connectedWorkspaces(
  account: AccountWorkspace[],
  env: Record<string, string | undefined>,
): Workspace[] {
  return account
    .filter((w) => {
      const p = envPrefix(w.slug);
      return Boolean(w.uid) && env[`${p}_WORKSPACE_KEY`] === w.uid && Boolean(env[`${p}_WORKSPACE_SECRET`]);
    })
    .map((w) => ({ slug: w.slug, name: w.name || w.slug }));
}

/** Black or white, whichever reads better on a #rrggbb colour. Null for anything else. */
export function readableOn(color: string): string | null {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color.trim());
  if (!m) return null;
  const [r, g, b] = m
    .slice(1)
    .map((h) => parseInt(h, 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.179 ? "#000000" : "#ffffff";
}

export function toWorkspaceView(ws: Workspace, brand: { name?: string; primaryColor?: string }): WorkspaceView {
  const name = brand.name?.trim() || ws.name;
  const color = brand.primaryColor?.trim() ?? "";
  const fg = readableOn(color);
  return { ...ws, name, initial: name.slice(0, 1).toUpperCase(), accent: fg ? color : null, accentForeground: fg };
}

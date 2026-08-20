// Server-side resolver for the active workspace. Server Components and API
// routes read the active workspace here so there is ONE source of truth.
// The Management API uses one account-level Service Token; the workspace is
// selected by URL path. This helper builds those paths.
import "server-only";
import { cookies } from "next/headers";
import { Suprsend } from "@suprsend/node-sdk";
import { DEFAULT_WORKSPACE, getWorkspace, isWorkspaceSlug, type Workspace } from "@/lib/workspaces";

export async function getActiveWorkspace(): Promise<Workspace> {
  const slug = (await cookies()).get("wv_workspace")?.value;
  return getWorkspace(isWorkspaceSlug(slug) ? slug : DEFAULT_WORKSPACE);
}

/** Env-var prefix for a workspace's server credentials. slug "workvibe-loopride" → "SUPRSEND_WORKVIBE_LOOPRIDE". */
export function envPrefix(ws: Workspace): string {
  return `SUPRSEND_${ws.slug.replace(/-/g, "_").toUpperCase()}`;
}

/** Env-var prefix for a workspace's public (browser-exposed) credentials. */
export function publicEnvPrefix(ws: Workspace): string {
  return `NEXT_PUBLIC_SUPRSEND_${ws.slug.replace(/-/g, "_").toUpperCase()}`;
}

/** Node-SDK client for a workspace (hub.suprsend.com) — key + secret from env. */
export function suprsendClient(ws: Workspace) {
  const prefix = envPrefix(ws);
  const key = process.env[`${prefix}_WORKSPACE_KEY`];
  const secret = process.env[`${prefix}_WORKSPACE_SECRET`];
  if (!key || !secret) throw new Error(`Missing workspace key/secret for ${ws.slug}`);
  // SDK defaults to hub.suprsend.com (our SUPRSEND_HOST).
  return new Suprsend(key, secret);
}

export interface WorkspaceSecrets {
  workspaceKey: string;
  /** The signing key's UID (dashboard column "Signing Key UID", value `signing_key_…`).
   *  Used as the JWT `kid` — NOT the "Signing Key ID" (`ws_signk_…`), which yields a 401. */
  signingKeyUid: string;
  signingKeyB64: string;
}

/** Workspace key + secret — the pair hub's signed-request scheme authenticates with. */
export function getWorkspaceCredentials(ws: Workspace): { workspaceKey: string; workspaceSecret: string } {
  const prefix = envPrefix(ws);
  const workspaceKey = process.env[`${prefix}_WORKSPACE_KEY`];
  const workspaceSecret = process.env[`${prefix}_WORKSPACE_SECRET`];
  if (!workspaceKey || !workspaceSecret) throw new Error(`Missing workspace key/secret for ${ws.slug}`);
  return { workspaceKey, workspaceSecret };
}

/** Per-workspace secrets (workspace key + signing key) for the embedded editor JWT. */
export function getWorkspaceSecrets(ws: Workspace): WorkspaceSecrets {
  const prefix = envPrefix(ws);
  const workspaceKey = process.env[`${prefix}_WORKSPACE_KEY`];
  const signingKeyUid = process.env[`${prefix}_SIGNING_KEY_UID`];
  const signingKeyB64 = process.env[`${prefix}_SIGNING_KEY_B64`];
  if (!workspaceKey || !signingKeyUid || !signingKeyB64) {
    throw new Error(`Missing signing-key env for ${ws.slug}`);
  }
  return { workspaceKey, signingKeyUid, signingKeyB64 };
}

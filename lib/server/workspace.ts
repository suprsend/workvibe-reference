// Server-side workspace resolution. The workspace list comes from the SuprSend
// account (Management API), narrowed to the workspaces whose keys are in env — see
// connectedWorkspaces. Server Components and API routes read the active workspace
// here so there is ONE source of truth.
import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { Suprsend } from "@suprsend/node-sdk";
import { errMsg } from "@/lib/server/http";
import {
  NO_WORKSPACE_MESSAGE,
  connectedWorkspaces,
  envPrefix as prefixFor,
  toWorkspaceView,
  type AccountWorkspace,
  type Workspace,
  type WorkspaceView,
} from "@/lib/workspaces";

const MGMNT = (process.env.SUPRSEND_MGMNT_URL || "https://management-api.suprsend.com").replace(/\/+$/, "");

export const WORKSPACE_COOKIE = "wv_workspace";

// Paginated (meta.count / limit / offset). Bounded so a bad count can't spin forever.
async function fetchAccountWorkspaces(): Promise<AccountWorkspace[]> {
  const token = process.env.SUPRSEND_SERVICE_TOKEN;
  if (!token) throw new Error("SUPRSEND_SERVICE_TOKEN is not set");
  const all: AccountWorkspace[] = [];
  const limit = 100;
  for (let page = 0; page < 100; page++) {
    const res = await fetch(`${MGMNT}/v1/workspace/?limit=${limit}&offset=${page * limit}`, {
      headers: { Authorization: `ServiceToken ${token}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Listing workspaces failed (HTTP ${res.status})`);
    const body = (await res.json()) as { results?: AccountWorkspace[]; meta?: { count?: number } };
    const rows = body.results ?? [];
    all.push(...rows);
    if (rows.length === 0 || all.length >= (body.meta?.count ?? all.length)) break;
  }
  return all;
}

// Which workspaces qualify changes only when env does, and env is read at startup,
// so a successful lookup is kept for the life of the process. A failed one is not.
let connected: Promise<Workspace[]> | null = null;

export function listWorkspaces(): Promise<Workspace[]> {
  connected ??= fetchAccountWorkspaces()
    .then((account) => connectedWorkspaces(account, process.env))
    .catch((e) => {
      connected = null;
      throw e;
    });
  return connected;
}

/** Each connected workspace with its default brand's name and colour. Read per request, so brand edits show. */
export const listWorkspaceViews = cache(async (): Promise<WorkspaceView[]> => {
  const list = await listWorkspaces();
  return Promise.all(
    list.map(async (ws) => {
      try {
        const t = (await suprsendClient(ws).tenants.get("default")) as { tenant_name?: string; primary_color?: string };
        return toWorkspaceView(ws, { name: t.tenant_name, primaryColor: t.primary_color });
      } catch {
        return toWorkspaceView(ws, {});
      }
    }),
  );
});

/** For layouts: the list, or the reason it couldn't be read. */
export async function loadWorkspaceViews(): Promise<{ workspaces: WorkspaceView[]; error: string | null }> {
  try {
    return { workspaces: await listWorkspaceViews(), error: null };
  } catch (e) {
    return { workspaces: [], error: errMsg(e) };
  }
}

export async function getActiveWorkspace(): Promise<Workspace> {
  const [list, store] = await Promise.all([listWorkspaces(), cookies()]);
  const slug = store.get(WORKSPACE_COOKIE)?.value;
  // Until one is picked in the switcher, the first connected workspace is active.
  const ws = list.find((w) => w.slug === slug) ?? list[0];
  if (!ws) throw new Error(NO_WORKSPACE_MESSAGE);
  return ws;
}

/** Env-var prefix for a workspace's server credentials. slug "workvibe-emberoak" → "SUPRSEND_WORKVIBE_EMBEROAK". */
export function envPrefix(ws: Workspace): string {
  return prefixFor(ws.slug);
}

/** Env-var prefix for a workspace's public (browser-exposed) credentials. */
export function publicEnvPrefix(ws: Workspace): string {
  return `NEXT_PUBLIC_${prefixFor(ws.slug)}`;
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

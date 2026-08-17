// Admin-scoped read/write of ONE user's notification preferences (the Per-user
// support tool). Server-side: we mint a subscriber JWT for the picked distinct_id
// (same ES256 signing key as /api/subscriber-token) and call hub directly — the
// node SDK has no preference methods, so this is the supported path.
//
// Verified: GET  hub/v2/subscriber/{id}/category/?tenant_id=default → {results:[...]}
//           PATCH hub/v2/subscriber/{id}/category/{cat}/ {category, preference,
//                 opt_out_channels, is_editable} → 202. Channel-level prefs ride on
//                 opt_out_channels (BTS model), not a separate endpoint.
import "server-only";
import jwt from "jsonwebtoken";
import { getWorkspaceSecrets, publicEnvPrefix } from "@/lib/server/workspace";
import type { Workspace } from "@/lib/workspaces";

const HOST = (process.env.SUPRSEND_HOST || "https://hub.suprsend.com/").replace(/\/$/, "");

function headers(ws: Workspace, distinctId: string): Record<string, string> {
  const { signingKeyB64, signingKeyUid } = getWorkspaceSecrets(ws);
  const prefix = publicEnvPrefix(ws);
  const publicApiKey = process.env[`${prefix}_PUBLIC_KEY`];
  if (!publicApiKey) throw new Error(`public key not configured for ${ws.slug}`);
  const privateKey = Buffer.from(signingKeyB64, "base64").toString("utf-8");
  const now = Math.floor(Date.now() / 1000);
  const token = jwt.sign(
    { entity_type: "subscriber", entity_id: distinctId, iat: now, exp: now + 600, scope: { tenant_id: "default" } },
    privateKey,
    { algorithm: "ES256", header: { alg: "ES256", typ: "JWT", kid: signingKeyUid } },
  );
  return { "Content-Type": "application/json", Authorization: publicApiKey, "x-ss-signature": token };
}

export interface UserCategoryChannel {
  channel: string;
  preference: "opt_in" | "opt_out";
  is_editable?: boolean;
}
export interface UserCategory {
  category: string;
  name: string;
  description?: string | null;
  preference: "opt_in" | "opt_out" | "cant_unsubscribe";
  // null = the user never set this → they inherit the workspace default.
  // non-null = the user actively chose this preference themselves.
  original_preference?: "opt_in" | "opt_out" | "cant_unsubscribe" | null;
  is_editable?: boolean;
  channels?: UserCategoryChannel[] | null;
}

export async function getUserCategories(ws: Workspace, distinctId: string): Promise<UserCategory[]> {
  const res = await fetch(
    `${HOST}/v2/subscriber/${encodeURIComponent(distinctId)}/category/?tenant_id=default&show_opt_out_channels=true`,
    { headers: headers(ws, distinctId), cache: "no-store" },
  );
  if (!res.ok) throw new Error(`preferences read failed (${res.status})`);
  const body = (await res.json()) as { results?: UserCategory[] };
  return body.results ?? [];
}

export async function updateUserCategory(
  ws: Workspace,
  distinctId: string,
  category: string,
  preference: "opt_in" | "opt_out",
  optOutChannels: string[],
): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(
    `${HOST}/v2/subscriber/${encodeURIComponent(distinctId)}/category/${encodeURIComponent(category)}/?tenant_id=default`,
    {
      method: "PATCH",
      headers: headers(ws, distinctId),
      body: JSON.stringify({ category, preference, opt_out_channels: optOutChannels, is_editable: true }),
    },
  );
  return { ok: res.ok, status: res.status };
}

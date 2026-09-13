// Subscriber lists — the broadcast audience, and the trigger for the welcome
// (SuprSend emits $USER_ENTERED_LIST when someone joins).
//
// Metadata comes through the node SDK. Membership does NOT: the SDK has no method
// for it, so `GET /v1/subscriber_list/{list_id}/subscriber/` is called directly.
// That endpoint uses SuprSend's signed-request scheme rather than a bearer token —
// an HMAC over the verb, body digest, content type, date and path, sent as
// `Authorization: <workspace_key>:<signature>`. Same scheme the SDK signs with, so
// a wrong clock or a rewritten path fails as "Not Authenticated".
import "server-only";
import crypto from "node:crypto";
import type { Workspace } from "@/lib/workspaces";
import { suprsendClient as client, getWorkspaceCredentials } from "@/lib/server/workspace";
import { listUsers, type WorkUser } from "@/lib/server/users";

const HOST = (process.env.SUPRSEND_HOST || "https://hub.suprsend.com/").replace(/\/$/, "");

/** One member of a list, joined against the user roster. */
export interface ListMember {
  distinctId: string;
  joinedAt: string | null;
  user: WorkUser;
}

export interface SubscriberList {
  listId: string;
  name: string;
  description: string | null;
  /** Members who can actually be sent to — see the filter in getSubscriberList. */
  count: number;
  trackUserEntry: boolean;
  members: ListMember[];
}

function signedHeaders(ws: Workspace, path: string): Record<string, string> {
  const { workspaceKey, workspaceSecret } = getWorkspaceCredentials(ws);
  const date = new Date().toUTCString();
  const contentType = "application/json";
  // Body is empty for a GET, so the content-MD5 slot stays blank.
  const signString = `GET\n\n${contentType}\n${date}\n${path}`;
  const signature = crypto.createHmac("sha256", workspaceSecret).update(signString).digest("base64");
  return { "Content-Type": contentType, Date: date, Authorization: `${workspaceKey}:${signature}` };
}

interface RawMember {
  distinct_id: string;
  created_at?: string;
}

async function fetchMembers(ws: Workspace, listId: string): Promise<RawMember[]> {
  const out: RawMember[] = [];
  let after: string | null = null;
  // Cursor-paginated. Bounded so a malformed cursor can't spin forever.
  for (let page = 0; page < 20; page++) {
    const path = `/v1/subscriber_list/${encodeURIComponent(listId)}/subscriber/?limit=100${
      after ? `&after=${encodeURIComponent(after)}` : ""
    }`;
    const res = await fetch(`${HOST}${path}`, { headers: signedHeaders(ws, path), cache: "no-store" });
    if (!res.ok) throw new Error(`list members read failed (${res.status})`);
    const body = (await res.json()) as { results?: RawMember[]; meta?: { has_next?: boolean; after?: string | null } };
    out.push(...(body.results ?? []));
    if (!body.meta?.has_next || !body.meta.after) break;
    after = body.meta.after;
  }
  return out;
}

interface RawList {
  list_id: string;
  list_name?: string;
  list_description?: string | null;
  track_user_entry?: boolean;
}

/**
 * Every list in the workspace — whatever exists in the account, not a fixed id.
 * A list created in the SuprSend dashboard shows up here on the next load.
 */
export async function listSubscriberLists(ws: Workspace): Promise<SubscriberList[]> {
  const res = (await client(ws).subscriber_lists.get_all({ limit: 100 })) as { results?: RawList[] };
  const users = await listUsers(ws);
  return Promise.all((res.results ?? []).map((raw) => getSubscriberList(ws, raw.list_id, users)));
}

export async function getSubscriberList(ws: Workspace, listId: string, roster?: WorkUser[]): Promise<SubscriberList> {
  const [raw, members, users] = await Promise.all([
    client(ws).subscriber_lists.get(listId) as Promise<Record<string, unknown>>,
    fetchMembers(ws, listId),
    roster ?? listUsers(ws),
  ]);
  const byId = new Map(users.map((u) => [u.distinctId, u]));

  // Only members who resolve to a subscriber. A membership row can outlive the
  // subscriber it points at, and nothing can be delivered to one of those — it is
  // not part of the audience, so counting or listing it would overstate reach.
  // Reporting the roster count rather than SuprSend's `subscribers_count` keeps the
  // header and the table telling the same story.
  const joined: ListMember[] = members.flatMap((m) => {
    const user = byId.get(m.distinct_id);
    return user ? [{ distinctId: m.distinct_id, joinedAt: m.created_at ?? null, user }] : [];
  });

  return {
    listId,
    name: (raw.list_name as string) ?? listId,
    description: (raw.list_description as string) ?? null,
    count: joined.length,
    trackUserEntry: Boolean(raw.track_user_entry),
    members: joined.sort((a, b) => (b.joinedAt ?? "").localeCompare(a.joinedAt ?? "")),
  };
}

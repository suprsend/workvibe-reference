// Live users = SuprSend subscribers (the Users tab). Backed by the hub user API
// via the node SDK — list / get / remove. There is no create or update path:
// subscribers sign up in the customer's own product, and the demo roster is
// seeded by `provision.mjs users`. Name lives in user `properties`; email is the
// `$email` channel.
import "server-only";
import type { Workspace } from "@/lib/workspaces";
import { suprsendClient as client } from "@/lib/server/workspace";

// The whole-audience list every broadcast fans out to. Membership is written by
// `provision.mjs users`, which also creates the list — nothing in the app does.
export const ALL_SUBSCRIBERS_LIST = "all-subscribers";

export interface WorkUser {
  distinctId: string;
  name: string;
  email: string | null;
  hasInbox: boolean;
  createdAt: string | null;
}

interface RawUser {
  distinct_id: string;
  properties?: { name?: string };
  $email?: { value?: string }[];
  $inbox?: unknown[];
  created_at?: string;
}

function shape(u: RawUser): WorkUser {
  return {
    distinctId: u.distinct_id,
    name: u.properties?.name ?? u.distinct_id,
    email: u.$email?.[0]?.value ?? null,
    hasInbox: Array.isArray(u.$inbox) && u.$inbox.length > 0,
    createdAt: u.created_at ?? null,
  };
}

export async function listUsers(ws: Workspace): Promise<WorkUser[]> {
  const res = (await client(ws).users.list({ limit: 100 })) as { results?: RawUser[] };
  return (res.results ?? [])
    .map(shape)
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
}

export async function getUser(ws: Workspace, distinctId: string): Promise<WorkUser | null> {
  try {
    const u = (await client(ws).users.get(distinctId)) as RawUser;
    return u?.distinct_id ? shape(u) : null;
  } catch {
    return null;
  }
}

/** Update a user: sets email + name + role. */
export async function removeUser(ws: Workspace, distinctId: string) {
  return client(ws).users.delete(distinctId);
}

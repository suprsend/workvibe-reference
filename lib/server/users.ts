// Live users = SuprSend subscribers (the Users tab). Backed by the hub user API
// via the node SDK. Name lives in user `properties`; email is the `$email` channel.
//
// Real subscribers sign up in the customer's own product and arrive through
// `provision.mjs users` — that is the behaviour this app models. `createUser` is a
// TESTING affordance so a subscriber can be added without a provisioning run; it
// performs the same three steps as that stage, so an app-added subscriber is
// indistinguishable from a seeded one.
import "server-only";
import type { Workspace } from "@/lib/workspaces";
import { suprsendClient as client } from "@/lib/server/workspace";

// The whole-audience list every broadcast fans out to, and the trigger for the
// welcome: SuprSend emits $USER_ENTERED_LIST when someone joins it.
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

/** Next id in the same shape as the seeded roster (u_20431, u_51204). */
function nextDistinctId(existing: WorkUser[]): string {
  const seen = existing
    .map((u) => Number(/^u_(\d+)$/.exec(u.distinctId)?.[1]))
    .filter((n) => Number.isFinite(n));
  return `u_${(seen.length ? Math.max(...seen) : 20000) + 1}`;
}

/**
 * Add a subscriber the way a signup does: set their profile, then put them on the
 * all-subscribers list. The list add is the part that matters — it makes them a
 * broadcast recipient, and joining the list is what SuprSend emits
 * $USER_ENTERED_LIST for, which is what welcomes them. Creating the user alone
 * notifies nobody.
 */
export async function createUser(
  ws: Workspace,
  input: { name: string; email: string; distinctId?: string },
): Promise<WorkUser> {
  const c = client(ws);
  const distinctId = input.distinctId?.trim() || nextDistinctId(await listUsers(ws));

  if (await getUser(ws, distinctId)) {
    throw new Error(`${distinctId} already exists in this workspace.`);
  }

  const edit = c.users.get_edit_instance(distinctId);
  edit.add_email(input.email);
  edit.set({ name: input.name });
  await c.users.edit(edit);

  await c.subscriber_lists.add(ALL_SUBSCRIBERS_LIST, [distinctId]);

  return { distinctId, name: input.name, email: input.email, hasInbox: true, createdAt: new Date().toISOString() };
}

export async function removeUser(ws: Workspace, distinctId: string) {
  return client(ws).users.delete(distinctId);
}

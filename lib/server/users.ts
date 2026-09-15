// Live users = SuprSend subscribers (the Users tab). Backed by the hub user API
// via the node SDK. Name lives in user `properties`; email is the `$email` channel.
//
// Real subscribers sign up in the customer's own product. `createUser` stands in
// for that signup: it performs the same steps a signup integration would, so an
// app-added subscriber is indistinguishable from a real one.
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

/** Next id in the u_<number> shape the existing subscribers use (u_20431, u_51204). */
function nextDistinctId(existing: WorkUser[]): string {
  const seen = existing
    .map((u) => Number(/^u_(\d+)$/.exec(u.distinctId)?.[1]))
    .filter((n) => Number.isFinite(n));
  return `u_${(seen.length ? Math.max(...seen) : 20000) + 1}`;
}

interface RawList {
  list_id?: string;
  track_user_entry?: boolean;
}

/**
 * Make sure the all-subscribers list exists, and report whether it tracks user entry.
 *
 * `track_user_entry` is what makes SuprSend emit $USER_ENTERED_LIST, which runs the
 * welcome. The hub API accepts it on create but silently ignores it (create echoes
 * back false), and has no call to change it, so it can only be turned on from the
 * list's page in the dashboard. It must be on BEFORE anyone joins: a member who
 * joined while it was off never re-enters, so is never welcomed. Creating the list
 * when the Users screen loads gives that switch a list to sit on before the first
 * subscriber is added.
 *
 * Only a 404 creates the list. Create is an upsert, so calling it on any other
 * failure could overwrite a list someone has already set up.
 */
export async function ensureSubscribersList(ws: Workspace): Promise<{ trackUserEntry: boolean }> {
  const lists = client(ws).subscriber_lists;
  try {
    const list = (await lists.get(ALL_SUBSCRIBERS_LIST)) as RawList;
    return { trackUserEntry: Boolean(list?.track_user_entry) };
  } catch (e) {
    // The SDK's error message starts with the HTTP status ("404: …").
    if (!String((e as Error)?.message ?? "").startsWith("404")) throw e;
  }
  const created = (await lists.create({
    list_id: ALL_SUBSCRIBERS_LIST,
    list_name: "All subscribers",
    list_description: "Every subscriber in this workspace — the broadcast audience.",
    track_user_entry: true, // sent, but ignored by the API — see above
  })) as RawList;
  return { trackUserEntry: Boolean(created?.track_user_entry) };
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

  await ensureSubscribersList(ws);
  await c.subscriber_lists.add(ALL_SUBSCRIBERS_LIST, [distinctId]);

  return { distinctId, name: input.name, email: input.email, hasInbox: true, createdAt: new Date().toISOString() };
}

export async function removeUser(ws: Workspace, distinctId: string) {
  return client(ws).users.delete(distinctId);
}

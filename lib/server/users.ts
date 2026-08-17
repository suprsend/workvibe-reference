// Live users = SuprSend subscribers (the Users tab). Backed entirely by the
// hub user API via the node SDK — list / get / add (upsert) / remove (delete).
// Role + name live in user `properties`; email is the `$email` channel.
import "server-only";
import type { Workspace, WorkspaceSlug } from "@/lib/workspaces";
import { suprsendClient as client, envPrefix } from "@/lib/server/workspace";

// A Slack identity for the $slack channel. Either an incoming webhook (one fixed
// channel — simplest for a demo) or a bot token + channel/user id (DMs).
export type SlackIdentity =
  | { incoming_webhook: { url: string } }
  | { bot_token: string; channel: string };

// The workspace's Slack incoming webhook (one channel for everyone). Set per
// workspace in env — we auto-attach it to every user, so Slack delivery +
// the Slack preference toggle work without anyone pasting a URL per user.
export function getWorkspaceSlackWebhook(ws: Workspace): SlackIdentity | null {
  const prefix = envPrefix(ws);
  const url = process.env[`${prefix}_SLACK_WEBHOOK`];
  return url ? { incoming_webhook: { url } } : null;
}

// Event emitted when a new subscriber is added. An event-triggered workflow
// (trigger_type:"event") listens for it and fires onboarding automatically —
// no manual Send test. SuprSend upper-cases the name.
export const ONBOARDING_EVENT = "subscriber_onboarded";

// A static list every subscriber joins on creation — the whole-audience list,
// and the target every broadcast fans out to.
export const ALL_SUBSCRIBERS_LIST = "all-subscribers";

// Nothing else creates the list — we only ever add to it, and `add` against a
// list that doesn't exist fails. So create it on first use. The promise is
// cached per workspace, so concurrent adds share one create and every later add
// skips the round-trip; a failure is evicted so the next add retries.
const listReady = new Map<WorkspaceSlug, Promise<void>>();

function ensureSubscribersList(ws: Workspace): Promise<void> {
  const cached = listReady.get(ws.slug);
  if (cached) return cached;
  const ready = (async () => {
    const c = client(ws);
    try {
      await c.subscriber_lists.get(ALL_SUBSCRIBERS_LIST);
      return; // already there
    } catch {
      // Not found — create it below.
    }
    await c.subscriber_lists.create({
      list_id: ALL_SUBSCRIBERS_LIST,
      list_name: "All subscribers",
      list_description: "Every subscriber in this workspace — the broadcast audience.",
    });
  })().catch((e) => {
    listReady.delete(ws.slug);
    throw e;
  });
  listReady.set(ws.slug, ready);
  return ready;
}

/** Add a user to the all-subscribers list, creating the list if needed. Best-effort. */
export async function addToSubscribersList(ws: Workspace, distinctId: string) {
  await ensureSubscribersList(ws);
  return client(ws).subscriber_lists.add(ALL_SUBSCRIBERS_LIST, [distinctId]);
}

export interface WorkUser {
  distinctId: string;
  name: string;
  email: string | null;
  role: string | null;
  hasInbox: boolean;
  hasSlack: boolean;
  createdAt: string | null;
}

interface RawUser {
  distinct_id: string;
  properties?: { name?: string; role?: string };
  $email?: { value?: string }[];
  $inbox?: unknown[];
  $slack?: unknown[];
  created_at?: string;
}

function shape(u: RawUser): WorkUser {
  return {
    distinctId: u.distinct_id,
    name: u.properties?.name ?? u.distinct_id,
    email: u.$email?.[0]?.value ?? null,
    role: u.properties?.role ?? null,
    hasInbox: Array.isArray(u.$inbox) && u.$inbox.length > 0,
    hasSlack: Array.isArray(u.$slack) && u.$slack.length > 0,
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

/** Add or update a user: sets email + name + role (+ optional Slack identity). */
export async function upsertUser(
  ws: Workspace,
  distinctId: string,
  data: { name?: string; email?: string; role?: string; slack?: SlackIdentity },
) {
  const c = client(ws);
  const edit = c.users.get_edit_instance(distinctId);
  if (data.email) edit.add_email(data.email);
  if (data.slack) edit.add_slack(data.slack);
  const props: Record<string, string> = {};
  if (data.name) props.name = data.name;
  if (data.role) props.role = data.role;
  if (Object.keys(props).length) edit.set(props);
  return c.users.edit(edit);
}

export async function removeUser(ws: Workspace, distinctId: string) {
  return client(ws).users.delete(distinctId);
}

// hub.suprsend.com access via the node SDK — user upsert ($email) + workflow trigger
// + list broadcast. Per-workspace credentials (workspace key + secret). The
// Management API can't set $email; only the SDK ingestion can.
import "server-only";
// `Event` is aliased — the bare name collides with the global `Event` that
// undici/axios reference internally (a CJS `const { Event }` shadow breaks them).
import {
  WorkflowTriggerRequest,
  SubscriberListBroadcast,
  Event as SuprsendEvent,
} from "@suprsend/node-sdk";
import type { Workspace } from "@/lib/workspaces";
import { suprsendClient as client } from "@/lib/server/workspace";
import { ALL_SUBSCRIBERS_LIST } from "@/lib/server/users";

/** Trigger a workflow for one recipient with the given data payload. */
export async function triggerWorkflow(
  ws: Workspace,
  workflow: string,
  distinctId: string,
  data: Record<string, unknown>,
  tenantId = "default",
) {
  const c = client(ws);
  const req = new WorkflowTriggerRequest({
    workflow,
    recipients: [{ distinct_id: distinctId }],
    tenant_id: tenantId,
    data,
  });
  return c.workflows.trigger(req);
}

/**
 * Track an event for a user. Any workflow whose `trigger_events` includes this
 * event name fires automatically with this user as the recipient — no direct
 * workflow trigger. This is how "the order is ready → a nudge goes out" works:
 * we emit `order_ready` and the event-triggered workflow runs.
 * SuprSend upper-cases event names on ingestion (we author the same way).
 */
export async function trackEvent(
  ws: Workspace,
  distinctId: string,
  eventName: string,
  properties: Record<string, unknown> = {},
  tenantId = "default",
) {
  const c = client(ws);
  const event = new SuprsendEvent(distinctId, eventName, properties, { tenant_id: tenantId });
  return c.track_event(event);
}

/** Channels a broadcast can be sent on (the SuprSend list-broadcast enum). */
export type BroadcastChannel =
  | "androidpush"
  | "iospush"
  | "webpush"
  | "email"
  | "sms"
  | "whatsapp"
  | "slack"
  | "inbox"
  | "messenger"
  | "ms_teams";

/**
 * Broadcast one template to every subscriber on the all-subscribers list.
 *
 * A broadcast targets a TEMPLATE, not a workflow — there is no journey, just one
 * send fanned out across the list. `notification_category` must be a PROMOTIONAL
 * category: per SuprSend's docs a broadcast on a transactional or system category
 * delays other traffic on those categories, so callers validate the category
 * against the live promotional tree before calling this.
 *
 * Omitting `channels` lets SuprSend use every channel the template has enabled.
 * Per-subscriber preferences still filter the send either way.
 *
 * Note: the SDK's `broadcast()` resolves with `{ success: false, … }` on an API
 * error instead of throwing — the caller has to check `success`.
 */
export async function broadcastToList(
  ws: Workspace,
  template: string,
  category: string,
  data: Record<string, unknown>,
  channels?: BroadcastChannel[],
  tenantId = "default",
) {
  const c = client(ws);
  const req = new SubscriberListBroadcast(
    {
      list_id: ALL_SUBSCRIBERS_LIST,
      template,
      notification_category: category,
      ...(channels?.length ? { channels } : {}),
      data,
    },
    { tenant_id: tenantId },
  );
  return c.subscriber_lists.broadcast(req);
}

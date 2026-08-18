import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import {
  listUsers, upsertUser, removeUser, getUser, getWorkspaceSlackWebhook,
  addToSubscribersList, ONBOARDING_EVENT,
} from "@/lib/server/users";
import { trackEvent } from "@/lib/server/hub";
import { getWorkflowTriggerData } from "@/lib/suprsend-mgmt";

const ONBOARDING_WORKFLOW = "subscriber-onboarding";

export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    const users = await listUsers(ws);
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

// Add or update a user. New users get a distinct_id slugged from the name.
export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { distinct_id, name, email, role } = await req.json();
    const id = distinct_id || slug(name);
    if (!id) return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
    const isCreate = !distinct_id;
    if (isCreate) {
      // creating new — require an email so they can actually receive
      if (!email || !/.+@.+\..+/.test(email)) {
        return NextResponse.json({ ok: false, error: "A valid email is required for a new user." }, { status: 400 });
      }
      if (await getUser(ws, id)) {
        return NextResponse.json({ ok: false, error: `A user “${id}” already exists.` }, { status: 409 });
      }
    }
    // Slack is a workspace-level channel (one webhook → one channel for everyone),
    // so a new user inherits the workspace's webhook automatically — Slack
    // delivery + the Slack preference toggle work without per-user setup.
    const slackIdentity = isCreate ? getWorkspaceSlackWebhook(ws) ?? undefined : undefined;
    await upsertUser(ws, id, { name, email, role, slack: slackIdentity });

    // New subscriber → add to the all-subscribers list (the broadcast audience)
    // and emit the onboarding event. The event-triggered onboarding workflow
    // fires automatically (showcases an event trigger end-to-end — no manual
    // Send test). Best-effort: a failure here must not fail the user create, so
    // we don't await-throw it.
    let onboardingFired = false;
    if (isCreate) {
      // Carry the FULL onboarding payload on the event — every variable the
      // onboarding templates use, pulled from their sample data, with this
      // subscriber's real name layered on top. Without this the welcome email
      // renders with blank merge fields on a live add.
      const base = await getWorkflowTriggerData(ws.slug, ONBOARDING_WORKFLOW).catch(() => ({}));
      const payload = { ...base, user_name: name ?? id, name: name ?? id, role: role ?? "" };
      await Promise.allSettled([
        addToSubscribersList(ws, id),
        trackEvent(ws, id, ONBOARDING_EVENT, payload).then(() => { onboardingFired = true; }),
      ]);
    }
    return NextResponse.json({ ok: true, distinctId: id, onboardingFired });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const id = new URL(req.url).searchParams.get("distinct_id");
    if (!id) return NextResponse.json({ ok: false, error: "distinct_id required" }, { status: 400 });
    await removeUser(ws, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

function slug(name?: string): string {
  return (name ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

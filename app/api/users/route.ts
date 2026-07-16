import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import {
  listUsers, upsertUser, removeUser, getUser, getWorkspaceSlackWebhook,
  addToAllEmployeesList, ONBOARDING_EVENT,
} from "@/lib/server/users";
import { trackEvent } from "@/lib/server/hub";
import { getWorkflowTriggerData } from "@/lib/suprsend-mgmt";

const ONBOARDING_WORKFLOW = "employee-onboarding";

export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    const users = await listUsers(ws);
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

// Add or update an employee. New employees get a distinct_id slugged from the name.
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
        return NextResponse.json({ ok: false, error: "A valid email is required for a new employee." }, { status: 400 });
      }
      if (await getUser(ws, id)) {
        return NextResponse.json({ ok: false, error: `An employee “${id}” already exists.` }, { status: 409 });
      }
    }
    // Slack is a workspace-level channel (one webhook → one channel for everyone),
    // so a new employee inherits the workspace's webhook automatically — Slack
    // delivery + the Slack preference toggle work without per-employee setup.
    const slackIdentity = isCreate ? getWorkspaceSlackWebhook(ws) ?? undefined : undefined;
    await upsertUser(ws, id, { name, email, role, slack: slackIdentity });

    // New hire → add to the company list and emit the onboarding event. The
    // event-triggered onboarding workflow fires automatically (showcases an
    // event trigger end-to-end — no manual Send test). Best-effort: a failure
    // here must not fail the user create, so we don't await-throw it.
    let onboardingFired = false;
    if (isCreate) {
      // Carry the FULL onboarding payload on the event — every variable the
      // onboarding templates use (link, manager_name, manager_contact, …) pulled
      // from their sample data, with this hire's real name layered on top. Without
      // this the welcome email renders with blank merge fields on a live add.
      const base = await getWorkflowTriggerData(ws.slug, ONBOARDING_WORKFLOW).catch(() => ({}));
      const payload = { ...base, employee_name: name ?? id, name: name ?? id, role: role ?? "" };
      await Promise.allSettled([
        addToAllEmployeesList(ws, id),
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

import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { triggerWorkflow, trackEvent } from "@/lib/server/hub";
import { getWorkflowTriggerData, getWorkflow } from "@/lib/suprsend-mgmt";
import { getUser } from "@/lib/server/users";

// Send a test: resolve the recipient from the LIVE SuprSend roster (the Users tab),
// then trigger the workflow. A user added in the Users tab is selectable here.
export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { workflow_slug, employee_id, data } = await req.json();
    if (!workflow_slug || !employee_id) {
      return NextResponse.json({ ok: false, error: "workflow_slug and employee_id are required." }, { status: 400 });
    }
    const emp = await getUser(ws, employee_id);
    if (!emp) {
      return NextResponse.json({ ok: false, error: "Unknown employee for this workspace." }, { status: 400 });
    }
    if (!emp.email) {
      return NextResponse.json({ ok: false, error: `${emp.name} has no email — add one in the Users tab.` }, { status: 400 });
    }

    // The recipient already exists (it came from the live roster) with an $email,
    // so we trigger directly. Build a complete payload: every variable from the
    // workflow's templates' sample data, then the chosen employee, then any caller
    // overrides — this prevents "missing variables" render failures.
    const base = await getWorkflowTriggerData(ws.slug, workflow_slug);
    // Pass the employee's name + role so templates can render {{employee_name}} and
    // {{role}} directly (reliable — a plain trigger variable, no dependency on
    // SuprSend auto-injecting recipient properties).
    const payload = { ...base, employee_name: emp.name, role: emp.role ?? "", ...(data ?? {}) };

    // Trigger the RIGHT way for this workflow's trigger type. An event-triggered
    // workflow can't be fired by the workflow-trigger API — it only runs when its
    // event is tracked. So for trigger_type:"event" we emit the linked event (with
    // the same complete payload as data) for this employee; SuprSend then fires the
    // workflow. API workflows trigger directly. Either way the template vars are
    // satisfied by `payload`, so renders never fail on missing variables.
    const wf = await getWorkflow(ws.slug, workflow_slug);
    const wfBody = (wf?.body ?? {}) as { trigger_type?: string; trigger_events?: string[] };
    const isEvent = wfBody.trigger_type === "event";
    const eventName = wfBody.trigger_events?.[0];

    if (isEvent && eventName) {
      await trackEvent(ws, emp.distinctId, eventName, payload);
    } else {
      await triggerWorkflow(ws, workflow_slug, emp.distinctId, payload);
    }

    return NextResponse.json({ ok: true, recipient: emp.name, email: emp.email, via: isEvent ? "event" : "api" });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

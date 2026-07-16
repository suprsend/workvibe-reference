"use client";

import * as React from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers";

export function SendTest({
  workflowSlug,
  data,
}: {
  workflowSlug: string;
  data?: Record<string, unknown>;
}) {
  const { users, usersLoading } = useWorkspace();
  // Only users with an email can receive a test send.
  const roster = users.filter((u) => u.email);
  const [picked, setPicked] = React.useState("");
  const [sending, setSending] = React.useState(false);

  // Derive the effective selection: the user's pick if still valid, else the first
  // deliverable user. No effect needed — avoids cascading-render churn on load.
  const employeeId = roster.some((u) => u.distinctId === picked) ? picked : roster[0]?.distinctId ?? "";

  async function send() {
    if (!employeeId) return;
    setSending(true);
    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_slug: workflowSlug, employee_id: employeeId, data }),
      });
      const d = await res.json();
      if (d.ok) toast.success("Test sent", { description: `Triggered for ${d.recipient} (${d.email}).` });
      else toast.error("Couldn’t send test", { description: d.error });
    } catch {
      toast.error("Couldn’t reach SuprSend.");
    } finally {
      setSending(false);
    }
  }

  if (!usersLoading && roster.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No employees with an email yet. Add one in the Users tab to send a test.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-muted-foreground">Send a test to</span>
      <select
        value={employeeId}
        onChange={(e) => setPicked(e.target.value)}
        disabled={usersLoading || roster.length === 0}
        className="rounded-md border border-border bg-background px-2.5 py-1.5 text-sm"
      >
        {roster.map((e) => (
          <option key={e.distinctId} value={e.distinctId}>
            {e.name} · {e.email}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={send} disabled={sending || !employeeId}>
        <Send className="size-3.5" /> {sending ? "Sending…" : "Send test"}
      </Button>
    </div>
  );
}

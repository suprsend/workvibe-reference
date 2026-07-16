"use client";

import * as React from "react";
import { toast } from "sonner";
import { Activity, RefreshCw } from "lucide-react";
import type { MessageRecord } from "@/lib/server/messages";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RunsView } from "@/components/executions/runs-view";
import { MessagesTable } from "@/components/executions/messages-table";

// Remount per workspace for a fresh fetch + skeleton (mirrors templates-client).
export function ExecutionsClient() {
  const { workspace } = useWorkspace();
  return <ExecutionsBody key={workspace} />;
}

function ExecutionsBody() {
  const [messages, setMessages] = React.useState<MessageRecord[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const res = await fetch("/api/executions", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn’t load executions.");
        setMessages([]);
      } else {
        setError(null);
        setMessages(data.messages);
      }
    } catch {
      setError("Couldn’t reach SuprSend.");
      setMessages([]);
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/executions", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!data.ok) {
          setError(data.error ?? "Couldn’t load executions.");
          setMessages([]);
        } else {
          setMessages(data.messages);
        }
      } catch {
        if (active) {
          setError("Couldn’t reach SuprSend.");
          setMessages([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Re-fire a run for the same recipient (recipient id = seed employee id).
  const resend = React.useCallback(
    async (m: MessageRecord) => {
      if (!m.workflowSlug || !m.recipientId) return;
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflow_slug: m.workflowSlug, employee_id: m.recipientId }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.ok) {
        toast.success("Re-triggered", { description: `${m.workflowName ?? m.workflowSlug} → ${m.recipientId}` });
        setTimeout(() => void load(true), 2000);
      } else {
        toast.error("Couldn’t re-trigger", { description: data.error });
      }
    },
    [load],
  );

  const fresh = messages !== null;
  const runCount = fresh ? new Set(messages!.map((m) => m.idempotencyKey)).size : 0;

  return (
    <>
      <PageHeader
        title="Executions"
        description="Every notification sent — as workflow runs you can expand, or as a filterable message log."
        actions={
          fresh && messages!.length > 0 ? (
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing}>
              <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {!fresh ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : messages!.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No runs yet"
          description="Trigger a workflow with “Send test” and each run shows up here — as a timeline and as a message log."
        />
      ) : (
        <Tabs defaultValue="runs" className="gap-4">
          <div className="flex items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="runs">Workflow runs</TabsTrigger>
              <TabsTrigger value="log">Message log</TabsTrigger>
            </TabsList>
            <span className="text-xs text-muted-foreground">
              {runCount} run{runCount === 1 ? "" : "s"} · {messages!.length} message{messages!.length === 1 ? "" : "s"}
            </span>
          </div>

          <TabsContent value="runs">
            <RunsView messages={messages!} onResend={resend} />
          </TabsContent>
          <TabsContent value="log">
            <MessagesTable messages={messages!} onResend={resend} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}

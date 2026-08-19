"use client";

import * as React from "react";
import { Workflow as WorkflowIcon, Zap, Tag, Send, MousePointerClick, BellRing, SquareArrowOutUpRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { WorkflowDetailDialog } from "@/components/workflows/workflow-detail-dialog";
import { SendTest } from "@/components/workflows/send-test";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo, fmtLocal } from "@/lib/message-display";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface WorkflowRow {
  slug: string;
  name: string;
  category?: string;
  trigger_type?: string;
  description?: string;
  status?: string;
  last_executed_at?: string | null;
  tree?: { nodes?: unknown[] };
}

export function WorkflowsClient() {
  const { workspace } = useWorkspace();
  return <WorkflowsBody key={workspace} />;
}

function WorkflowsBody() {
  const [rows, setRows] = React.useState<WorkflowRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [testWf, setTestWf] = React.useState<{ slug: string; name: string } | null>(null);
  const [detailSlug, setDetailSlug] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/workflows", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!data.ok) {
          setError(data.error ?? "Couldn’t load workflows.");
          setRows([]);
        } else {
          setRows(data.workflows);
        }
      } catch {
        if (active) {
          setError("Couldn’t reach SuprSend.");
          setRows([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Workflows"
        description="Automated notification journeys — triggers, waits, and sends."
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={WorkflowIcon}
          title="No workflows yet"
          description="Create a workflow in the SuprSend dashboard. It shows up here, where you can view its flow and send a test."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <div className="min-w-[820px]">
            <div className="grid grid-cols-[minmax(0,1fr)_6rem_12rem_5rem_4rem_6rem_11rem] items-center gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <span>Workflow</span>
              <span>Status</span>
              <span>Category</span>
              <span>Trigger</span>
              <span className="text-right">Nodes</span>
              <span className="text-right">Last run</span>
              <span className="sr-only">Actions</span>
            </div>
            {rows.map((w) => {
              const nodeCount = w.tree?.nodes?.length ?? 0;
              const active = w.status === "active" || Boolean(w.status == null);
              return (
                <div
                  key={w.slug}
                  className="grid grid-cols-[minmax(0,1fr)_6rem_12rem_5rem_4rem_6rem_11rem] items-center gap-3 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/20"
                >
                  <button onClick={() => setDetailSlug(w.slug)} className="min-w-0 text-left">
                    <div className="truncate text-sm font-medium hover:underline">{w.name}</div>
                    <code className="text-xs text-muted-foreground">{w.slug}</code>
                  </button>
                  <Badge variant={active ? "secondary" : "outline"} className="gap-1">
                    <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    {active ? "Active" : "Draft"}
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Tag className="size-3" /> {w.category ?? "—"}
                  </Badge>
                  <TriggerBadge type={w.trigger_type} />
                  <span className="text-right text-sm tabular-nums text-muted-foreground">{nodeCount}</span>
                  <span className="text-right text-xs text-muted-foreground" title={w.last_executed_at ? fmtLocal(w.last_executed_at) : "Never run"}>
                    {w.last_executed_at ? timeAgo(w.last_executed_at) : "—"}
                  </span>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Open flow"
                      aria-label={`Open ${w.name} flow`}
                      onClick={() => setDetailSlug(w.slug)}
                    >
                      <SquareArrowOutUpRight className="size-4" />
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTestWf({ slug: w.slug, name: w.name })}>
                      <Send className="size-3.5" /> Send test
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <WorkflowDetailDialog
        slug={detailSlug}
        open={detailSlug !== null}
        onOpenChange={(o) => !o && setDetailSlug(null)}
      />

      <Dialog open={testWf !== null} onOpenChange={(o) => !o && setTestWf(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a test — {testWf?.name}</DialogTitle>
          </DialogHeader>
          {testWf && <SendTest workflowSlug={testWf.slug} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

// How each workflow is triggered — the badge makes the trigger mechanism scannable.
const TRIGGERS: Record<string, { label: string; icon: typeof Zap; hint: string }> = {
  api: { label: "API", icon: MousePointerClick, hint: "Triggered on demand — Send test, Resend, or a backend API call." },
  event: { label: "Event", icon: BellRing, hint: "Fires automatically when an event is tracked — e.g. adding a subscriber emits subscriber_onboarded and this workflow sends their onboarding." },
};

function TriggerBadge({ type }: { type?: string }) {
  const t = TRIGGERS[type ?? "api"] ?? TRIGGERS.api;
  const Icon = t.icon;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1 cursor-default">
            <Icon className="size-3" /> {t.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{t.hint}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

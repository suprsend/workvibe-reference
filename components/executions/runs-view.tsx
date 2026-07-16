"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import type { MessageRecord } from "@/lib/server/messages";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/providers";
import {
  activityBadge,
  lastActivityIso,
  runStatusBadge,
  type RunStatus,
  CHANNEL_ICON,
  CHANNEL_LABEL,
  humanizeNode,
  timeAgo,
  fmtLocal,
  fmtDuration,
} from "@/lib/message-display";

interface Step {
  ref: string;
  firstAt: string | null;
  messages: MessageRecord[];
}
interface Run {
  key: string;
  recipientId: string;
  workflowName: string | null;
  tenantId: string | null;
  startedAt: string | null;
  endedAt: string | null;
  steps: Step[];
  total: number;
  delivered: number;
  failed: number;
  read: number;
  status: RunStatus;
}

function firstStamp(msgs: MessageRecord[]): string | null {
  return msgs.map((m) => m.triggeredAt ?? m.createdAt).filter(Boolean).sort()[0] ?? null;
}

function buildRuns(messages: MessageRecord[]): Run[] {
  const byKey = new Map<string, MessageRecord[]>();
  for (const m of messages) {
    const arr = byKey.get(m.idempotencyKey) ?? [];
    arr.push(m);
    byKey.set(m.idempotencyKey, arr);
  }

  const runs: Run[] = [];
  for (const [key, msgs] of byKey) {
    const byNode = new Map<string, MessageRecord[]>();
    for (const m of msgs) {
      const ref = m.nodeRef ?? "unknown";
      const arr = byNode.get(ref) ?? [];
      arr.push(m);
      byNode.set(ref, arr);
    }
    const steps = [...byNode.entries()]
      .map(([ref, ms]) => ({ ref, firstAt: firstStamp(ms), messages: ms }))
      .sort((a, b) => (a.firstAt ?? "").localeCompare(b.firstAt ?? ""));

    const delivered = msgs.filter((m) => !m.failed && m.deliveredAt).length;
    const failed = msgs.filter((m) => m.failed).length;
    const read = msgs.filter((m) => m.readAt).length;
    let status: RunStatus;
    if (failed > 0 && delivered === 0) status = "failed";
    else if (failed > 0) status = "partial";
    else if (delivered < msgs.length) status = "in_progress";
    else status = "delivered";

    runs.push({
      key,
      recipientId: msgs[0]?.recipientId ?? "",
      workflowName: msgs[0]?.workflowName ?? msgs[0]?.workflowSlug ?? null,
      tenantId: msgs[0]?.tenantId ?? null,
      startedAt: firstStamp(msgs),
      endedAt: msgs.map((m) => lastActivityIso(m)).filter(Boolean).sort().reverse()[0] ?? null,
      steps,
      total: msgs.length,
      delivered,
      failed,
      read,
      status,
    });
  }
  return runs.sort((a, b) => (b.startedAt ?? "").localeCompare(a.startedAt ?? ""));
}

export function RunsView({
  messages,
  onResend,
}: {
  messages: MessageRecord[];
  onResend: (m: MessageRecord) => void | Promise<void>;
}) {
  const runs = React.useMemo(() => buildRuns(messages), [messages]);

  return (
    <div className="space-y-2">
      {runs.map((run) => (
        <RunRow key={run.key} run={run} onResend={onResend} />
      ))}
    </div>
  );
}

function RunRow({ run, onResend }: { run: Run; onResend: (m: MessageRecord) => void | Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const { users } = useWorkspace();
  const recipient = users.find((u) => u.distinctId === run.recipientId)?.name ?? run.recipientId ?? "(unknown)";
  const rs = runStatusBadge(run.status);

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/20"
      >
        <ChevronRight className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {run.workflowName ?? "Workflow run"} <span className="font-normal text-muted-foreground">· {recipient}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Started {timeAgo(run.startedAt)} · {run.steps.length} step{run.steps.length === 1 ? "" : "s"} · {run.total} message
            {run.total === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {run.read > 0 && <span className="text-xs text-muted-foreground">{run.read} read</span>}
          <Badge variant={rs.tone} className={rs.className}>{rs.label}</Badge>
        </div>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10 px-4 py-4">
          <ol className="space-y-0">
            {run.steps.map((step, idx) => (
              <li key={step.ref} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                      step.messages.some((m) => m.failed)
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  {idx < run.steps.length - 1 && <div className="my-1 w-px flex-1 bg-border" />}
                </div>

                <div className="min-w-0 flex-1 pb-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{humanizeNode(step.ref)}</span>
                    <span className="text-xs text-muted-foreground" title={fmtLocal(step.firstAt)}>
                      {timeAgo(step.firstAt)}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1.5">
                    {[...step.messages]
                      .sort((a, b) => a.channel.localeCompare(b.channel))
                      .map((m) => (
                        <ChannelRow key={m.messageId} m={m} onResend={onResend} />
                      ))}
                  </div>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-1 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
            <span>
              Run <code className="text-foreground">{run.key.slice(0, 8)}</code>
            </span>
            {run.startedAt && run.endedAt && fmtDuration(run.startedAt, run.endedAt) && (
              <span>Duration {fmtDuration(run.startedAt, run.endedAt)}</span>
            )}
            <span>
              {run.delivered} delivered · {run.failed} failed · {run.read} read
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ChannelRow({ m, onResend }: { m: MessageRecord; onResend: (m: MessageRecord) => void | Promise<void> }) {
  const Icon = CHANNEL_ICON[m.channel];
  const { label, tone } = activityBadge(m);
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        <span className="inline-flex w-20 shrink-0 items-center gap-1 text-muted-foreground">
          {Icon && <Icon className="size-3" />} {CHANNEL_LABEL[m.channel] ?? m.channel}
        </span>
        <Badge variant={tone}>{label}</Badge>
        {m.templateName && (
          <span className="truncate text-muted-foreground">
            {m.templateName}
            {m.templateVersion != null && <span className="opacity-60"> v{m.templateVersion}</span>}
          </span>
        )}
        {m.vendorName && <span className="text-muted-foreground">· via {m.vendorName}</span>}
        <span className="ml-auto text-muted-foreground" title={fmtLocal(lastActivityIso(m))}>
          {fmtLocal(lastActivityIso(m))}
        </span>
        {m.failed && (
          <Button
            variant="outline"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              void onResend(m);
            }}
          >
            Resend
          </Button>
        )}
      </div>
      {m.failed && m.failureReason && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-2.5 py-1.5 text-xs text-destructive">
          {m.failureReason}
        </div>
      )}
    </div>
  );
}

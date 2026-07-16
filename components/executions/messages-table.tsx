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
  CHANNEL_ICON,
  CHANNEL_LABEL,
  humanizeNode,
  timeAgo,
  fmtLocal,
  fmtDuration,
} from "@/lib/message-display";

const READ_OPTIONS = ["All", "Read", "Unread"] as const;

export function MessagesTable({
  messages,
  onResend,
}: {
  messages: MessageRecord[];
  onResend: (m: MessageRecord) => void | Promise<void>;
}) {
  const [channel, setChannel] = React.useState("All");
  const [activity, setActivity] = React.useState("All");
  const [template, setTemplate] = React.useState("All");
  const [read, setRead] = React.useState<(typeof READ_OPTIONS)[number]>("All");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  // Filter options derived from the data — never show a filter with no matches.
  const channels = React.useMemo(
    () => ["All", ...[...new Set(messages.map((m) => m.channel))].filter(Boolean).sort()],
    [messages],
  );
  const activities = React.useMemo(
    () => ["All", ...[...new Set(messages.map((m) => activityBadge(m).label))].sort()],
    [messages],
  );
  const templates = React.useMemo(
    () => ["All", ...[...new Set(messages.map((m) => m.templateName).filter(Boolean))].sort() as string[]],
    [messages],
  );

  const rows = React.useMemo(
    () =>
      messages.filter((m) => {
        if (channel !== "All" && m.channel !== channel) return false;
        if (activity !== "All" && activityBadge(m).label !== activity) return false;
        if (template !== "All" && m.templateName !== template) return false;
        if (read !== "All") {
          if (m.channel !== "inbox") return false;
          if (read === "Read" ? !m.isRead : m.isRead) return false;
        }
        return true;
      }),
    [messages, channel, activity, template, read],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-3">
        <Filter label="Channel" value={channel} onChange={setChannel} options={channels} />
        <Filter label="Activity" value={activity} onChange={setActivity} options={activities} />
        <Filter label="Template" value={template} onChange={setTemplate} options={templates} />
        <Filter label="Read" value={read} onChange={(v) => setRead(v as (typeof READ_OPTIONS)[number])} options={[...READ_OPTIONS]} hint="inbox only" />
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} of {messages.length}
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Notification</span>
          <span className="w-24 text-right">Recipient</span>
          <span className="w-28 text-right">Activity</span>
          <span className="w-28 text-right">Last seen</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">No messages match these filters.</div>
        ) : (
          rows.map((m) => (
            <Row
              key={m.messageId}
              m={m}
              open={expanded === m.messageId}
              onToggle={() => setExpanded(expanded === m.messageId ? null : m.messageId)}
              onResend={onResend}
            />
          ))
        )}
      </div>
    </div>
  );
}

function Row({
  m,
  open,
  onToggle,
  onResend,
}: {
  m: MessageRecord;
  open: boolean;
  onToggle: () => void;
  onResend: (m: MessageRecord) => void | Promise<void>;
}) {
  const { users } = useWorkspace();
  const Icon = CHANNEL_ICON[m.channel];
  const { label, tone } = activityBadge(m);
  const recipient = users.find((u) => u.distinctId === m.recipientId)?.name ?? m.recipientId;
  const last = lastActivityIso(m);

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        onClick={onToggle}
        className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-3 text-left hover:bg-muted/20"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
          {Icon && <Icon className="size-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate text-sm font-medium">{m.templateName ?? humanizeNode(m.nodeRef)}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{CHANNEL_LABEL[m.channel] ?? m.channel}</span>
        </span>
        <span className="w-24 truncate text-right text-xs text-muted-foreground">{recipient}</span>
        <span className="w-28 text-right">
          <Badge variant={tone}>{label}</Badge>
        </span>
        <span className="w-28 text-right text-xs text-muted-foreground">{timeAgo(last)}</span>
      </button>

      {open && (
        <div className="border-t border-border bg-muted/10 px-4 py-4">
          <EventTimeline m={m} />

          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-3">
            <Field label="Workflow step" value={m.workflowName ? `${m.workflowName} → ${humanizeNode(m.nodeRef)}` : "—"} />
            <Field label="Template" value={m.templateName ? `${m.templateName}${m.templateVersion != null ? ` v${m.templateVersion}` : ""}` : "—"} />
            <Field label="Recipient" value={m.recipientId || "—"} />
            <Field label="Email" value={m.recipientEmail ?? "—"} />
            <Field label="Vendor" value={m.vendorNickname ?? m.vendorName ?? "—"} />
            <Field label="Category" value={m.category ?? "—"} />
            {m.channel === "inbox" && (
              <Field
                label="Read state"
                value={m.isRead ? `Read${m.readAt ? ` · ${fmtLocal(m.readAt)}` : ""}` : "Unread"}
              />
            )}
          </div>

          {m.failed && m.failureReason && (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <span className="font-semibold">Failure reason: </span>
              {m.failureReason}
            </div>
          )}

          <div className="mt-3 flex items-center gap-3">
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Raw event JSON</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-background p-3 text-xs">
                {JSON.stringify(m, null, 2)}
              </pre>
            </details>
            {m.failed && (
              <Button variant="outline" size="sm" className="ml-auto h-7" onClick={() => void onResend(m)}>
                Resend
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Triggered → Delivered → Seen → Clicked, with elapsed time between stages.
// Read is intentionally absent: it's a mutable flag, shown in the detail grid.
function EventTimeline({ m }: { m: MessageRecord }) {
  const steps: { label: string; iso: string | null; done: boolean; fail?: boolean }[] = m.failed
    ? [
        { label: "Triggered", iso: m.triggeredAt ?? m.createdAt, done: true },
        { label: "Failed", iso: m.deliveredAt ?? m.triggeredAt, done: true, fail: true },
      ]
    : [
        { label: "Triggered", iso: m.triggeredAt ?? m.createdAt, done: true },
        { label: "Delivered", iso: m.deliveredAt, done: Boolean(m.deliveredAt) },
        { label: m.channel === "email" ? "Opened" : "Seen", iso: m.seenAt, done: Boolean(m.seenAt) },
        { label: "Clicked", iso: m.clickedAt, done: Boolean(m.clickedAt) },
      ];

  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Event timeline</div>
      <div className="flex flex-wrap items-start gap-1">
        {steps.map((s, i) => {
          const prev = i > 0 ? steps[i - 1] : null;
          const dur = prev?.iso && s.iso ? fmtDuration(prev.iso, s.iso) : "";
          return (
            <div key={s.label} className="flex items-start">
              {i > 0 && (
                <div className="flex flex-col items-center px-2 pt-1.5">
                  <div className="h-px w-8 bg-border" />
                  {dur && <span className="mt-0.5 text-[10px] text-muted-foreground">{dur}</span>}
                </div>
              )}
              <div className="flex flex-col">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <span
                    className={`size-2 rounded-full ${
                      s.fail ? "bg-destructive" : s.done ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  />
                  <span className={s.fail ? "text-destructive" : s.done ? "" : "text-muted-foreground"}>{s.label}</span>
                </span>
                <span className="ml-3.5 mt-0.5 text-[11px] text-muted-foreground">{s.iso ? fmtLocal(s.iso) : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="mb-0.5 font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="truncate" title={value}>{value}</div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  hint?: string;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-ring focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {hint && value !== "All" && <span className="text-[10px] italic text-muted-foreground">{hint}</span>}
    </label>
  );
}

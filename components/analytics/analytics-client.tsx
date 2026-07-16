"use client";

import * as React from "react";
import { BarChart3 } from "lucide-react";
import type { MessageRecord } from "@/lib/server/messages";
import type { OptOutSummary } from "@/lib/server/opt-outs";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { computeAnalytics, CHANNEL_LABEL, CHANNEL_ICON, type Breakdown } from "@/lib/message-display";

export function AnalyticsClient() {
  const { workspace } = useWorkspace();
  return <AnalyticsBody key={workspace} />;
}

function AnalyticsBody() {
  const [records, setRecords] = React.useState<MessageRecord[] | null>(null);
  const [optOuts, setOptOuts] = React.useState<OptOutSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [channel, setChannel] = React.useState("All");
  // The live workflow slugs + template names, to mark Active vs Archived rows
  // (analytics is built from the historical log, which outlives deleted workflows).
  const [liveWorkflows, setLiveWorkflows] = React.useState<Set<string>>(new Set());
  const [liveTemplates, setLiveTemplates] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [msgRes, optRes, wfRes, tmplRes] = await Promise.all([
          fetch("/api/executions", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/opt-outs", { cache: "no-store" }).then((r) => r.json()),
          fetch("/api/workflows", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
          fetch("/api/templates", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
        ]);
        if (!active) return;
        if (!msgRes.ok) setError(msgRes.error ?? "Couldn’t load analytics.");
        else setRecords(msgRes.messages);
        if (optRes.ok) setOptOuts(optRes.summary);
        setLiveWorkflows(new Set((wfRes.workflows ?? []).map((w: { slug: string }) => w.slug)));
        setLiveTemplates(new Set((tmplRes.templates ?? []).map((t: { name: string }) => t.name)));
      } catch {
        if (active) setError("Couldn’t reach SuprSend.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const channels = React.useMemo(
    () => ["All", ...[...new Set((records ?? []).map((m) => m.channel))].filter(Boolean).sort()],
    [records],
  );
  // Funnel + template/workflow respect the channel filter; the per-channel
  // comparison always shows every channel.
  const data = React.useMemo(() => {
    if (!records) return null;
    const scoped = channel === "All" ? records : records.filter((m) => m.channel === channel);
    return computeAnalytics(scoped);
  }, [records, channel]);
  const channelPerf = React.useMemo(() => (records ? computeAnalytics(records).byChannel : []), [records]);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Delivery and engagement across channels, plus who’s opting out — broken down by template and workflow."
        actions={
          records && records.length > 0 ? (
            <label className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Channel</span>
              <select
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-ring focus:outline-none"
              >
                {channels.map((c) => (
                  <option key={c} value={c}>
                    {c === "All" ? "All channels" : CHANNEL_LABEL[c] ?? c}
                  </option>
                ))}
              </select>
            </label>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {!error && !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : data && records!.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing to measure yet"
          description="Send your first notifications and delivery metrics show up here, broken down by channel, template and workflow."
        />
      ) : data ? (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Sent" value={data.overall.sent} />
            <Metric label="Delivered" value={data.overall.delivered} rate={rate(data.overall.delivered, data.overall.sent)} />
            <Metric label="Opened" value={data.overall.opened} rate={rate(data.overall.opened, data.overall.delivered)} />
            <Metric label="Failed" value={data.overall.failed} tone={data.overall.failed > 0 ? "bad" : "default"} />
          </div>

          {data.overall.sent === 0 ? (
            <p className="text-sm text-muted-foreground">No {CHANNEL_LABEL[channel] ?? channel} messages in this workspace.</p>
          ) : (
            <>
              <ChannelPerformance rows={channelPerf} />
              <OptOuts summary={optOuts} />
              <BreakdownTable title="By template" rows={data.byTemplate} activeKeys={liveTemplates} />
              <BreakdownTable title="By workflow" rows={data.byWorkflow} activeKeys={liveWorkflows} />
            </>
          )}
        </div>
      ) : null}
    </>
  );
}

function rate(part: number, whole: number): string | undefined {
  if (whole <= 0) return undefined;
  return `${Math.round((part / whole) * 100)}%`;
}

function Metric({ label, value, rate, tone = "default" }: { label: string; value: number; rate?: string; tone?: "default" | "bad" }) {
  return (
    <div className="rounded-xl border border-border p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className={`text-2xl font-semibold tabular-nums ${tone === "bad" ? "text-destructive" : ""}`}>{value}</span>
        {rate && <span className="text-xs text-muted-foreground">{rate}</span>}
      </div>
    </div>
  );
}

// "Which channels are performing best?" — delivery + open rate per channel.
function ChannelPerformance({ rows }: { rows: Breakdown[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">By channel</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => {
          const Icon = CHANNEL_ICON[r.label];
          return (
            <div key={r.label} className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-1.5 text-sm font-medium">
                {Icon && <Icon className="size-4 text-muted-foreground" />}
                {CHANNEL_LABEL[r.label] ?? r.label}
                <span className="ml-auto text-xs font-normal text-muted-foreground">{r.sent} sent</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Stat label="Delivered" value={rate(r.delivered, r.sent) ?? "—"} />
                <Stat label="Opened" value={rate(r.opened, r.delivered) ?? "—"} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-3 py-2">
      <div className="text-base font-semibold tabular-nums">{value}</div>
      <div className="text-muted-foreground">{label}</div>
    </div>
  );
}

// "Are employees opting out?" — computed from real preference state. One row per
// category; every count is verifiable against each user's preferences.
const OPTOUT_CHANNELS = ["email", "inbox", "slack"] as const;
// Plain count cell — meaning lives in the column header, not in colour. Zeros are
// dimmed so the eye lands on the non-zero numbers.
function Count({ n, title }: { n: number; title?: string }) {
  return (
    <span title={title} className={`text-right tabular-nums ${n === 0 ? "text-muted-foreground/40" : "font-medium"}`}>
      {n}
    </span>
  );
}
function OptOuts({ summary }: { summary: OptOutSummary | null }) {
  if (!summary) return null;
  const anything = summary.rows.some(
    (r) => r.userOptOut > 0 || r.defaultOptOut > 0 || Object.keys(r.channelOptOuts).length > 0,
  );
  const cols = "grid grid-cols-[1fr_5.5rem_6.5rem_5rem_5rem_5rem] items-center gap-2";
  const chTotal = (c?: { muted: number; byDefault: number }) => (c?.muted ?? 0) + (c?.byDefault ?? 0);
  return (
    <div>
      <h2 className="text-sm font-semibold">Opt-outs</h2>
      <p className="mb-2 text-xs text-muted-foreground">
        Per category — who isn’t receiving, and why. Counted live from {summary.totalUsers} employees’ preferences.
      </p>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className={`${cols} border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground`}>
          <span>Category</span>
          <span className="text-right" title="Category off — the employee turned the whole category off themselves">Opted out</span>
          <span className="text-right" title="Category off — never subscribed, inherited an off-by-default category">Off by default</span>
          <span className="text-right" title="Category on, but Email off for this employee">Email off</span>
          <span className="text-right" title="Category on, but Inbox off for this employee">Inbox off</span>
          <span className="text-right" title="Category on, but Slack off for this employee">Slack off</span>
        </div>
        {summary.rows.map((r) => (
          <div key={r.category} className={`${cols} border-b border-border px-4 py-3 text-sm last:border-0`}>
            <span className="font-medium">{r.name}</span>
            <Count n={r.userOptOut} />
            <Count n={r.defaultOptOut} />
            {OPTOUT_CHANNELS.map((ch) => (
              <Count key={ch} n={chTotal(r.channelOptOuts[ch])} />
            ))}
          </div>
        ))}
      </div>
      {!anything && (
        <p className="mt-1 text-xs text-muted-foreground">No opt-outs yet — everyone’s receiving every category.</p>
      )}
    </div>
  );
}

// `activeKeys` = the slugs/names that still exist live. When provided, an "Active"
// column flags which rows are current vs. archived — analytics is built from the
// historical message log, so deleted workflows/templates still appear here.
function BreakdownTable({ title, rows, activeKeys }: { title: string; rows: Breakdown[]; activeKeys?: Set<string> }) {
  if (rows.length === 0) return null;
  const cols = activeKeys ? "grid-cols-[1fr_5rem_auto_auto_auto_auto]" : "grid-cols-[1fr_auto_auto_auto_auto]";
  // Active rows first, then archived — keeps the current set up top.
  const sorted = activeKeys
    ? [...rows].sort((a, b) => Number(isLive(b, activeKeys)) - Number(isLive(a, activeKeys)) || b.sent - a.sent)
    : rows;
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">{title}</h2>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className={`grid ${cols} items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground`}>
          <span>Name</span>
          {activeKeys && <span>Status</span>}
          <span className="w-14 text-right">Sent</span>
          <span className="w-20 text-right">Delivered</span>
          <span className="w-16 text-right">Opened</span>
          <span className="w-14 text-right">Failed</span>
        </div>
        {sorted.map((r) => {
          const live = activeKeys ? isLive(r, activeKeys) : true;
          return (
            <div
              key={r.label}
              className={`grid ${cols} items-center gap-4 border-b border-border px-4 py-3 text-sm last:border-0 hover:bg-muted/20 ${activeKeys && !live ? "opacity-55" : ""}`}
            >
              <span className="truncate font-medium">{r.label}</span>
              {activeKeys && (
                <span>
                  {live ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600">
                      <span className="size-1.5 rounded-full bg-emerald-500" /> Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      Archived
                    </span>
                  )}
                </span>
              )}
              <span className="w-14 text-right tabular-nums">{r.sent}</span>
              <span className="w-20 text-right tabular-nums">
                {r.delivered}
                <span className="ml-1 text-xs text-muted-foreground">{rate(r.delivered, r.sent)}</span>
              </span>
              <span className="w-16 text-right tabular-nums">{r.opened}</span>
              <span className={`w-14 text-right tabular-nums ${r.failed > 0 ? "text-destructive" : "text-muted-foreground"}`}>
                {r.failed}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function isLive(r: Breakdown, activeKeys: Set<string>): boolean {
  return r.slug != null && activeKeys.has(r.slug);
}

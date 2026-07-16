"use client";

import * as React from "react";
import { toast } from "sonner";
import { SlidersHorizontal } from "lucide-react";
import type { PrefCategory, Pref } from "@/lib/server/preference-config";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { CHANNEL_ICON, CHANNEL_LABEL } from "@/lib/message-display";

// Channels the workspace authors templates for. (Only channels with a connected
// vendor actually reach users — Email today; Inbox once enabled in SuprSend.)
const CHANNELS = ["email", "inbox", "slack"];

// Plain-English: what the DEFAULT subscription state is for a new employee, and
// whether they're allowed to change it. (SuprSend: opt_in / opt_out / cant_unsubscribe.)
const PREF_LABEL: Record<Pref, string> = {
  opt_in: "On by default · employee can turn off",
  opt_out: "Off by default · employee can turn on",
  cant_unsubscribe: "Always on · employee can’t turn off",
};

interface Row extends PrefCategory {
  channels: string[]; // unified default-channel set (routed by preference on save)
}

export function WorkspaceDefaultsClient() {
  const { workspace } = useWorkspace();
  return <Body key={workspace} />;
}

function Body() {
  const [rows, setRows] = React.useState<Row[] | null>(null);
  const [original, setOriginal] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/preference-config", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!data.ok) {
          setError(data.error ?? "Couldn’t load defaults.");
          setRows([]);
          return;
        }
        const mapped: Row[] = (data.categories as PrefCategory[]).map((c) => ({
          ...c,
          channels: c.preference === "cant_unsubscribe" ? c.mandatoryChannels : c.optInChannels,
        }));
        setRows(mapped);
        setOriginal(JSON.stringify(mapped));
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

  // Auto-save: every change persists immediately (no Save button). The fetch fires
  // synchronously on the user action — not debounced — so navigating away can't drop
  // a write. `original` tracks the last-saved state to show a "Saved" indicator.
  function commit(next: Row[]) {
    setRows(next);
    void saveRows(next);
  }
  function update(slug: string, patch: Partial<Row>) {
    if (!rows) return;
    commit(rows.map((r) => (r.category === slug ? { ...r, ...patch } : r)));
  }
  function toggleChannel(slug: string, ch: string) {
    if (!rows) return;
    commit(
      rows.map((r) =>
        r.category === slug
          ? { ...r, channels: r.channels.includes(ch) ? r.channels.filter((c) => c !== ch) : [...r.channels, ch] }
          : r,
      ),
    );
  }

  async function saveRows(rs: Row[]) {
    setSaving(true);
    try {
      const edits = rs.map((r) => ({
        category: r.category,
        preference: r.preference,
        optInChannels: r.channels,
        mandatoryChannels: r.channels,
      }));
      const res = await fetch("/api/admin/preference-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edits }),
      });
      const data = await res.json();
      if (data.ok) setOriginal(JSON.stringify(rs));
      else toast.error("Couldn’t save", { description: data.error });
    } catch {
      toast.error("Couldn’t reach SuprSend.");
    } finally {
      setSaving(false);
    }
  }
  const savedUp = rows !== null && JSON.stringify(rows) === original;

  const byRoot = React.useMemo(() => {
    const groups: Record<string, Row[]> = {};
    for (const r of rows ?? []) (groups[r.root] ??= []).push(r);
    return groups;
  }, [rows]);

  return (
    <>
      <PageHeader
        title="Preference defaults"
        description="The starting notification settings a new employee gets in this workspace. Changes save automatically."
        actions={
          rows !== null ? (
            <span className="text-xs text-muted-foreground">{saving ? "Saving…" : savedUp ? "All changes saved" : ""}</span>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {rows && rows.length > 0 && (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
          These are <strong>defaults for new employees</strong>. They don’t change someone who already has settings — to stop a
          notification for a specific employee right now, use <strong>Per-user</strong>. (“Required” is the one setting enforced
          for everyone — it can’t be opted out of.)
        </div>
      )}


      {rows === null ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={SlidersHorizontal}
          title="No categories yet"
          description="Add notification categories in SuprSend and they’ll appear here for you to set defaults and channels."
        />
      ) : (
        <div className="space-y-6">
          {["transactional", "promotional", "system"].filter((r) => byRoot[r]?.length).map((root) => (
            <div key={root}>
              <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{root}</h2>
              <div className="space-y-2">
                {byRoot[root].map((r) => (
                  <div key={r.category} className="rounded-lg border border-border p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{r.name}</div>
                        {r.description && <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>}
                      </div>
                      <select
                        value={r.preference}
                        onChange={(e) => update(r.category, { preference: e.target.value as Pref })}
                        className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs focus:border-ring focus:outline-none"
                      >
                        {(Object.keys(PREF_LABEL) as Pref[]).map((p) => (
                          <option key={p} value={p}>
                            {PREF_LABEL[p]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-3">
                      {r.preference === "opt_out" ? (
                        // SuprSend stores no default channels for an off-by-default
                        // category (verified: opt_out → channels persist as null).
                        // Channels apply once an employee turns it on, so we don't
                        // show toggles here — editing them couldn't be saved.
                        <span className="text-xs text-muted-foreground">
                          Off by default — channels apply once an employee turns this on.
                        </span>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">
                            {r.preference === "cant_unsubscribe" ? "Mandatory channels" : "Default channels · new hires"}
                          </span>
                          {CHANNELS.map((ch) => {
                            const Icon = CHANNEL_ICON[ch];
                            return (
                              <label key={ch} className="flex items-center gap-1.5 text-xs">
                                <span className="flex items-center gap-1 text-muted-foreground">
                                  {Icon && <Icon className="size-3.5" />}
                                  {CHANNEL_LABEL[ch] ?? ch}
                                </span>
                                <Switch
                                  size="sm"
                                  checked={r.channels.includes(ch)}
                                  onCheckedChange={() => toggleChannel(r.category, ch)}
                                />
                              </label>
                            );
                          })}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

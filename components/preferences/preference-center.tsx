"use client";

import * as React from "react";
import { toast } from "sonner";
import { Bell, type LucideIcon } from "lucide-react";
import type { UserCategory, UserCategoryChannel } from "@/lib/server/subscriber-prefs";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { CHANNEL_ICON, CHANNEL_LABEL } from "@/lib/message-display";

// Shared notification preference center for ONE subscriber. Used by both
// User · Preferences (acting as the "viewing as" employee) and Admin · Per-user
// (acting on a picked employee). Reads/writes through a SYNCHRONOUS server route
// (`endpoint`) that PATCHes hub directly — no client-SDK debounce, so a toggle
// persists even if the user immediately navigates away (the bug BTS never had).
export function PreferenceCenter({
  distinctId,
  endpoint,
  emptyIcon = Bell,
  emptyTitle,
  emptyDescription,
}: {
  distinctId: string;
  endpoint: string;
  emptyIcon?: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [categories, setCategories] = React.useState<UserCategory[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    const res = await fetch(`${endpoint}?distinct_id=${encodeURIComponent(distinctId)}`, { cache: "no-store" });
    const data = await res.json();
    if (!data.ok) {
      setError(data.error ?? "Couldn’t load preferences.");
      setCategories([]);
    } else {
      setError(null);
      setCategories(data.categories);
    }
  }, [endpoint, distinctId]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${endpoint}?distinct_id=${encodeURIComponent(distinctId)}`, { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!data.ok) {
          setError(data.error ?? "Couldn’t load preferences.");
          setCategories([]);
        } else {
          setCategories(data.categories);
        }
      } catch {
        if (active) {
          setError("Couldn’t reach SuprSend.");
          setCategories([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [endpoint, distinctId]);

  // Synchronous, awaited write — fires immediately on toggle (no debounce). The
  // optimistic local state is reverted only if the server rejects it.
  async function persist(category: string, preference: "opt_in" | "opt_out", outChannels: string[]) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ distinct_id: distinctId, category, preference, opt_out_channels: outChannels }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        toast.error("Couldn’t save preference", { description: data.error });
        void reload();
      }
    } catch {
      toast.error("Couldn’t save preference");
      void reload();
    }
  }

  function toggleCategory(cat: UserCategory) {
    if (cat.is_editable === false || cat.preference === "cant_unsubscribe") return;
    const next: "opt_in" | "opt_out" = cat.preference === "opt_in" ? "opt_out" : "opt_in";
    setCategories((prev) => prev?.map((c) => (c.category === cat.category ? { ...c, preference: next } : c)) ?? prev);
    const out = (cat.channels ?? []).filter((c) => c.preference === "opt_out").map((c) => c.channel);
    void persist(cat.category, next, out);
  }

  function toggleChannel(cat: UserCategory, ch: UserCategoryChannel) {
    const next: "opt_in" | "opt_out" = ch.preference === "opt_in" ? "opt_out" : "opt_in";
    const updated: UserCategoryChannel[] = (cat.channels ?? []).map((c) =>
      c.channel === ch.channel ? { ...c, preference: next } : c,
    );
    setCategories((prev) => prev?.map((c) => (c.category === cat.category ? { ...c, channels: updated } : c)) ?? prev);
    const out = updated.filter((c) => c.preference === "opt_out").map((c) => c.channel);
    const catPref: "opt_in" | "opt_out" = cat.preference === "cant_unsubscribe" ? "opt_in" : cat.preference;
    void persist(cat.category, catPref, out);
  }

  if (error) {
    return <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>;
  }
  if (categories === null) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    );
  }
  if (categories.length === 0) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="space-y-2">
      {categories.map((cat) => {
        // A mandatory (cant_unsubscribe) category comes back from SuprSend as
        // preference:"opt_in" + is_editable:false — the lock is is_editable, NOT
        // the preference string. Treat either signal as locked.
        const locked = cat.is_editable === false || cat.preference === "cant_unsubscribe";
        const categoryOn = cat.preference !== "opt_out";
        return (
          <div key={cat.category} className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-medium">{cat.name}</div>
                {cat.description && <p className="mt-0.5 text-sm text-muted-foreground">{cat.description}</p>}
              </div>
              {locked ? (
                <Badge variant="outline" title="Required by the workspace — can’t opt out.">Required</Badge>
              ) : (
                <Switch checked={categoryOn} onCheckedChange={() => toggleCategory(cat)} aria-label={`Toggle ${cat.name}`} />
              )}
            </div>
            {categoryOn && cat.channels && cat.channels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-3">
                {cat.channels.map((ch) => {
                  const Icon = CHANNEL_ICON[ch.channel];
                  const on = ch.preference !== "opt_out";
                  const editable = ch.is_editable !== false;
                  return (
                    <label key={ch.channel} className="flex items-center gap-1.5 text-xs">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {Icon && <Icon className="size-3.5" />}
                        {CHANNEL_LABEL[ch.channel] ?? ch.channel}
                      </span>
                      {editable ? (
                        <Switch size="sm" checked={on} onCheckedChange={() => toggleChannel(cat, ch)} />
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Required</Badge>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

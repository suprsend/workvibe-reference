"use client";

import * as React from "react";
import Link from "next/link";
import { List as ListIcon, Megaphone, Mail, Zap } from "lucide-react";
import type { SubscriberList } from "@/lib/server/lists";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/message-display";

export function ListsClient() {
  const { workspace } = useWorkspace();
  return <Body key={workspace} />;
}

function Body() {
  const [list, setList] = React.useState<SubscriberList | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/lists", { cache: "no-store" });
        const d = await res.json();
        if (!active) return;
        if (d.ok) setList(d.list as SubscriberList);
        else setError(d.error ?? "Couldn’t load the list.");
      } catch {
        if (active) setError("Couldn’t reach SuprSend.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <PageHeader
        title="Lists"
        description="Who a broadcast goes to, and who any workflow triggered on list entry runs for."
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {!list && !error ? (
        <div className="max-w-3xl space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : !list ? null : list.members.length === 0 ? (
        <EmptyState
          icon={ListIcon}
          title="No one on the list yet"
          description="A broadcast to an empty list sends nothing. Add a subscriber, or run the provisioning users stage."
        />
      ) : (
        <div className="max-w-3xl space-y-4">
          <div className="rounded-lg border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{list.name}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{list.listId}</code>
                </div>
                {list.description && <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>}
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
                <Link href="/admin/broadcast">
                  <Megaphone className="size-4" /> Broadcast to this list
                </Link>
              </Button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
              <Badge variant="secondary">{list.count} subscribers</Badge>
              {list.trackUserEntry ? (
                <Badge variant="outline" className="gap-1 font-mono text-xs" title="Emitted when someone joins. Any workflow can trigger on it.">
                  <Zap className="size-3" /> $USER_ENTERED_LIST
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground" title="track_user_entry is off, so joining emits nothing.">
                  No entry event
                </Badge>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            {list.members.map((m) => (
              <div
                key={m.distinctId}
                className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {m.user.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{m.user.name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {m.user.email ? (
                      <>
                        <Mail className="size-3" /> {m.user.email}
                      </>
                    ) : (
                      <code>{m.distinctId}</code>
                    )}
                  </span>
                </span>
                <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
                  {m.joinedAt ? timeAgo(m.joinedAt) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/components/providers";
import { getWorkspace } from "@/lib/workspaces";

// Browser-only SDK → load client-side only.
const EditorMount = dynamic(() => import("@/components/templates/editor-mount"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function TemplateEditorView({
  slug,
  channels,
  name,
}: {
  slug: string;
  channels: string[];
  name: string;
}) {
  const { workspace, users, usersLoading } = useWorkspace();
  const accent = getWorkspace(workspace).accent;
  // Who the preview renders as. The editor resolves {{$recipient.*}} against a real
  // subscriber, so this is the live roster, not a fixed demo id. Admin screens have
  // no "Viewing as" — that's a User-view control — so the choice belongs here.
  // Derived, not stored in an effect: the pick if still valid, else the first
  // subscriber (which is also what every template's mock_data points at).
  const [picked, setPicked] = React.useState("");
  const recipient = users.some((u) => u.distinctId === picked) ? picked : users[0]?.distinctId ?? "";
  const [token, setToken] = React.useState<{ accessToken: string; workspaceUid: string } | null>(null);
  // Live channel set — re-fetched client-side (no-store) so a channel added moments
  // ago (e.g. via a workflow edit) always appears as a tab, never a stale payload.
  // Falls back to the server-passed `channels` for the first paint.
  const [liveChannels, setLiveChannels] = React.useState<string[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!recipient) return; // roster still loading — nothing to scope the token to
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/editor-token?recipient=${encodeURIComponent(recipient)}`);
        const d = await res.json();
        if (!active) return;
        if (d.accessToken) setToken({ accessToken: d.accessToken, workspaceUid: d.workspaceUid });
        else setError(d.error ?? "Couldn’t load the editor.");
      } catch {
        if (active) setError("Couldn’t reach the editor service.");
      }
    })();
    return () => {
      active = false;
    };
  }, [workspace, recipient]);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/templates?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const d = await res.json();
        if (!active || !d.ok || !d.template) return;
        const present = ["email", "inbox", "sms", "whatsapp", "slack"].filter((c) => d.template[c]);
        if (present.length) setLiveChannels(present);
      } catch {
        // non-fatal — fall back to the server-passed channels
      }
    })();
    return () => {
      active = false;
    };
  }, [slug, workspace]);

  const editorChannels = liveChannels ?? channels;

  return (
    <div className="flex flex-1 flex-col gap-4">
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/admin/templates"
          className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Templates
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{name}</span>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{slug}</code>

        {users.length > 0 && (
          <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            Preview as
            <select
              value={recipient}
              onChange={(e) => setPicked(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              {users.map((u) => (
                <option key={u.distinctId} value={u.distinctId}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="min-h-[78vh] flex-1 overflow-hidden rounded-lg border border-border">
        {error ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        ) : !token || usersLoading ? (
          <div className="space-y-3 p-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <EditorMount
            key={`${recipient}:${editorChannels.join(",")}`}
            workspaceUid={token.workspaceUid}
            slug={slug}
            channels={editorChannels}
            accessToken={token.accessToken}
            recipient={recipient}
            primary={accent}
          />
        )}
      </div>
    </div>
  );
}

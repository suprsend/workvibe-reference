"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { AlertCircle } from "lucide-react";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";

const InboxMount = dynamic(() => import("@/components/user/inbox-mount"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

export function InboxClient() {
  const { workspace, actorId } = useWorkspace();
  // Remount per workspace + impersonated employee so the SDK re-auths cleanly.
  return <InboxBody key={`${workspace}:${actorId}`} actorId={actorId} />;
}

function InboxBody({ actorId }: { actorId: string }) {
  const [auth, setAuth] = React.useState<{ token: string; publicApiKey: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/subscriber-token?distinct_id=${encodeURIComponent(actorId)}`);
        const d = await res.json();
        if (!active) return;
        if (d.token) setAuth({ token: d.token, publicApiKey: d.publicApiKey });
        else setError(d.error ?? "Couldn’t load your inbox.");
      } catch {
        if (active) setError("Couldn’t reach the inbox service.");
      }
    })();
    return () => {
      active = false;
    };
  }, [actorId]);

  return (
    <>
      <PageHeader title="Inbox" description="Your notifications from the People team." />
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : !auth ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border px-5">
          <InboxMount publicApiKey={auth.publicApiKey} distinctId={actorId} userToken={auth.token} />
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { useWorkspace } from "@/components/providers";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The User view acts as one subscriber, so it needs one. Renders the page only once
 * a subscriber is picked. Until then, no token or preference request is made with
 * an empty id — that failed with raw errors on a workspace without subscribers.
 */
export function SubscriberRequired({ children }: { children: React.ReactNode }) {
  const { users, usersLoading, actorId } = useWorkspace();

  if (!usersLoading && users.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No subscribers yet"
        description="The User view shows what one subscriber sees. Add a subscriber first, then pick them in Viewing as."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/users">Go to Users</Link>
          </Button>
        }
      />
    );
  }

  // Still loading the roster, or resolving which subscriber to view as. The actor
  // comes from a cookie, so it can name someone deleted since — wait until the
  // live roster confirms them.
  if (usersLoading || !users.some((u) => u.distinctId === actorId)) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return <>{children}</>;
}

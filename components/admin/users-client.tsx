"use client";

import * as React from "react";
import { toast } from "sonner";
import { Users, Trash2, Mail, Bell, BadgeCheck, UserPlus } from "lucide-react";
import type { WorkUser } from "@/lib/server/users";
import type { MessageRecord } from "@/lib/server/messages";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { PreferenceCenter } from "@/components/preferences/preference-center";
import { activityBadge, CHANNEL_ICON, CHANNEL_LABEL, timeAgo } from "@/lib/message-display";

export function UsersClient() {
  const { workspace } = useWorkspace();
  return <Body key={workspace} />;
}

function Body() {
  const { refreshUsers } = useWorkspace();
  const [users, setUsers] = React.useState<WorkUser[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);

  const load = React.useCallback(async (keep?: string) => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn’t load users.");
        setUsers([]);
      } else {
        setError(null);
        setUsers(data.users);
        setSelected((s) => keep ?? s ?? data.users[0]?.distinctId ?? null);
      }
    } catch {
      setError("Couldn’t reach SuprSend.");
      setUsers([]);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/users", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!data.ok) {
          setError(data.error ?? "Couldn’t load users.");
          setUsers([]);
        } else {
          setUsers(data.users);
          setSelected(data.users[0]?.distinctId ?? null);
        }
      } catch {
        if (active) {
          setError("Couldn’t reach SuprSend.");
          setUsers([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function remove(u: WorkUser) {
    const res = await fetch(`/api/users?distinct_id=${encodeURIComponent(u.distinctId)}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      toast.success("User removed", { description: u.name });
      setSelected(null);
      load(null as unknown as string);
      refreshUsers(); // keep the "viewing as" + Send-test roster in sync
    } else {
      toast.error("Couldn’t remove", { description: data.error });
    }
  }

  async function added(u: WorkUser) {
    setAdding(false);
    toast.success("Subscriber added", {
      description: `${u.name} — onboarding sent, and added to the broadcast list.`,
    });
    load(u.distinctId);
    refreshUsers();
  }

  const current = users?.find((u) => u.distinctId === selected) ?? null;

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Users"
          description="Everyone subscribed in this workspace — their contact, notification preferences, and what they’ve been sent. Real subscribers sign up in the customer’s own product; Add subscriber is here so you can exercise onboarding and list entry without a provisioning run."
        />
        <Button variant="outline" size="sm" className="mt-1 shrink-0 gap-1.5" onClick={() => setAdding(true)}>
          <UserPlus className="size-4" /> Add subscriber
        </Button>
      </div>

      <AddSubscriberDialog key={adding ? "open" : "closed"} open={adding} onOpenChange={setAdding} onAdded={added} />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {users === null ? (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          <Skeleton className="h-64 rounded-lg" />
          <Skeleton className="h-64 rounded-lg" />
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No subscribers yet"
          description="Run the provisioning users stage to seed this workspace’s demo subscribers. Real subscribers arrive when they sign up in the customer’s product."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          {/* List */}
          <div className="flex flex-col gap-1 rounded-lg border border-border p-2">
            {users.map((u) => (
              <button
                key={u.distinctId}
                onClick={() => setSelected(u.distinctId)}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  u.distinctId === selected ? "bg-accent" : "hover:bg-accent/60"
                }`}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
                  {u.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{u.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{u.email ?? u.distinctId}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Detail */}
          {current ? <UserDetail key={current.distinctId} user={current} onRemove={() => remove(current)} /> : null}
        </div>
      )}
    </>
  );
}

function UserDetail({ user, onRemove }: { user: WorkUser; onRemove: () => void }) {
  return (
    <div className="min-w-0 space-y-6">
      {/* Contact */}
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-base font-semibold">{user.name}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" /> {user.email ?? "—"}
              </span>
              <span className="flex items-center gap-1.5">
                <Bell className="size-3.5" /> Inbox {user.hasInbox ? "active" : "—"}
              </span>
              <code className="text-xs">{user.distinctId}</code>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="size-4" /> Remove
          </Button>
        </div>
      </div>

      {/* Preferences */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Notification preferences</h2>
        <PreferenceCenter
          distinctId={user.distinctId}
          endpoint="/api/admin/user-preferences"
          emptyIcon={BadgeCheck}
          emptyTitle="No categories for this user"
          emptyDescription="Once the workspace defines notification categories, this user’s settings show up here."
        />
      </div>

      {/* Delivery log */}
      <DeliveryLog distinctId={user.distinctId} />
    </div>
  );
}

function DeliveryLog({ distinctId }: { distinctId: string }) {
  const [rows, setRows] = React.useState<MessageRecord[] | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/executions", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        const mine = (data.ok ? (data.messages as MessageRecord[]) : []).filter((m) => m.recipientId === distinctId);
        setRows(mine);
      } catch {
        if (active) setRows([]);
      }
    })();
    return () => {
      active = false;
    };
  }, [distinctId]);

  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
      {rows === null ? (
        <Skeleton className="h-24 w-full rounded-lg" />
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing sent to this user yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          {rows.slice(0, 20).map((m) => {
            const Icon = CHANNEL_ICON[m.channel];
            const { label, tone } = activityBadge(m);
            return (
              <div key={m.messageId} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
                {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
                <span className="min-w-0 flex-1 truncate">{m.templateName ?? m.workflowName ?? "Notification"}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{CHANNEL_LABEL[m.channel] ?? m.channel}</span>
                <Badge variant={tone}>{label}</Badge>
                <span className="w-14 shrink-0 text-right text-xs text-muted-foreground">{timeAgo(m.triggeredAt ?? m.createdAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Add a subscriber — the same three steps a real signup performs: create the
 * profile, join the broadcast list, emit the onboarding event. Both the welcome
 * and the list-entry workflow fire from it, which is the point: it's the one
 * action that exercises both paths.
 */
function AddSubscriberDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdded: (u: WorkUser) => void;
}) {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [distinctId, setDistinctId] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  async function submit() {
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, distinct_id: distinctId.trim() || undefined }),
      });
      const d = await res.json();
      if (d.ok) onAdded(d.user as WorkUser);
      else toast.error("Couldn’t add subscriber", { description: d.error });
    } catch {
      toast.error("Couldn’t reach SuprSend.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add subscriber</DialogTitle>
          <DialogDescription>
            Sends their onboarding notification and adds them to the broadcast list.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sam Rivera" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Email</span>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="sam@example.com"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">
              Distinct ID <span className="font-normal text-muted-foreground">— optional</span>
            </span>
            <Input
              value={distinctId}
              onChange={(e) => setDistinctId(e.target.value)}
              placeholder="Generated from the roster if left blank"
              className="font-mono text-xs"
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !name.trim() || !email.trim()}>
            <UserPlus className="size-4" /> {saving ? "Adding…" : "Add subscriber"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

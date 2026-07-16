"use client";

import * as React from "react";
import { toast } from "sonner";
import { Users, Plus, Trash2, Mail, Bell, BadgeCheck, MessageSquare } from "lucide-react";
import type { WorkUser } from "@/lib/server/users";
import type { MessageRecord } from "@/lib/server/messages";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
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

  const load = React.useCallback(async (keep?: string) => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn’t load employees.");
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
          setError(data.error ?? "Couldn’t load employees.");
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
      toast.success("Employee removed", { description: u.name });
      setSelected(null);
      load(null as unknown as string);
      refreshUsers(); // keep the "viewing as" + Send-test roster in sync
    } else {
      toast.error("Couldn’t remove", { description: data.error });
    }
  }

  const current = users?.find((u) => u.distinctId === selected) ?? null;

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone in this workspace — their contact, role, notification preferences, and what they’ve been sent."
        actions={users ? <AddUser onAdded={(id) => { load(id); refreshUsers(); }} /> : undefined}
      />

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
          title="No employees yet"
          description="Add an employee and they’ll start receiving notifications according to the workspace defaults."
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
                  <span className="block truncate text-xs text-muted-foreground">{u.role ?? u.email ?? u.distinctId}</span>
                </span>
              </button>
            ))}
          </div>

          {/* Detail */}
          {current ? <UserDetail key={current.distinctId} user={current} onChanged={() => load(current.distinctId)} onRemove={() => remove(current)} /> : null}
        </div>
      )}
    </>
  );
}

function UserDetail({ user, onChanged, onRemove }: { user: WorkUser; onChanged: () => void; onRemove: () => void }) {
  const [role, setRole] = React.useState(user.role ?? "");
  const roleDirty = (user.role ?? "") !== role;

  async function saveRole() {
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ distinct_id: user.distinctId, role }),
    });
    const data = await res.json();
    if (data.ok) {
      toast.success("Role updated");
      onChanged();
    } else {
      toast.error("Couldn’t update role", { description: data.error });
    }
  }

  return (
    <div className="min-w-0 space-y-6">
      {/* Contact + role */}
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
              <span className="flex items-center gap-1.5">
                <MessageSquare className="size-3.5" /> Slack {user.hasSlack ? "active" : "—"}
              </span>
              <code className="text-xs">{user.distinctId}</code>
            </div>
          </div>
          <Button variant="outline" size="sm" className="text-destructive" onClick={onRemove}>
            <Trash2 className="size-4" /> Remove
          </Button>
        </div>
        <div className="mt-4 flex items-end gap-2 border-t border-border pt-4">
          <label className="flex-1 text-xs">
            <span className="mb-1 block text-muted-foreground">Role</span>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Avionics Engineer" className="h-9" />
          </label>
          <Button size="sm" className="h-9" disabled={!roleDirty} onClick={saveRole}>
            Save role
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
          emptyTitle="No categories for this employee"
          emptyDescription="Once the workspace defines notification categories, this employee’s settings show up here."
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
          Nothing sent to this employee yet.
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

function AddUser({ onAdded }: { onAdded: (id: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(
          data.onboardingFired ? "Employee added — onboarding sent" : "Employee added",
          { description: data.onboardingFired ? `${name} will receive the welcome automatically` : name },
        );
        setOpen(false);
        setName("");
        setEmail("");
        setRole("");
        onAdded(data.distinctId);
      } else {
        toast.error("Couldn’t add", { description: data.error });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> Add employee
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Name</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aarav Sharma" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Email</span>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" type="email" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">Role (optional)</span>
            <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Software Engineer" />
          </label>
          <p className="text-xs text-muted-foreground">
            Adding an employee emits an <code>employee_onboarded</code> event — the event-triggered
            onboarding workflow sends their welcome automatically, no manual test. They start on the
            workspace default preferences and join the workspace Slack channel.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || !name.trim() || !email.trim()}>
            {busy ? "Adding…" : "Add employee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

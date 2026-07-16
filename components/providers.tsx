"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getWorkspace, type WorkspaceSlug } from "@/lib/workspaces";
import type { WorkUser } from "@/lib/server/users";

interface WorkspaceState {
  workspace: WorkspaceSlug;
  setWorkspace: (slug: WorkspaceSlug) => void;
  /** The employee currently being impersonated in the Employee view. */
  actorId: string;
  setActorId: (id: string) => void;
  /** Live SuprSend subscribers for the active workspace (the "viewing as" + Send-test roster). */
  users: WorkUser[];
  usersLoading: boolean;
  /** Re-fetch the live roster (call after add/remove in the Users tab). */
  refreshUsers: () => Promise<void>;
}

const WorkspaceContext = React.createContext<WorkspaceState | null>(null);

export function useWorkspace(): WorkspaceState {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within <AppProviders>");
  return ctx;
}

const YEAR = 60 * 60 * 24 * 365;
function writeCookie(key: string, value: string) {
  document.cookie = `${key}=${value}; path=/; max-age=${YEAR}; samesite=lax`;
}

export function AppProviders({
  children,
  initialWorkspace,
  initialActor,
}: {
  children: React.ReactNode;
  initialWorkspace: WorkspaceSlug;
  initialActor: string;
}) {
  const [workspace, setWs] = React.useState<WorkspaceSlug>(initialWorkspace);
  const [actorId, setAct] = React.useState<string>(initialActor);
  const [users, setUsers] = React.useState<WorkUser[]>([]);
  const [usersLoading, setUsersLoading] = React.useState(true);

  const setActorId = React.useCallback((id: string) => {
    setAct(id);
    writeCookie("wv_actor", id);
  }, []);

  // Load the live roster for the active workspace. Resolves the impersonated actor:
  // keep the current one if it still exists, otherwise fall back to the first user.
  // State is only set AFTER the fetch resolves (never synchronously in the effect).
  const refreshUsers = React.useCallback(async () => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const d = await res.json();
      const list: WorkUser[] = d.ok && Array.isArray(d.users) ? d.users : [];
      setUsers(list);
      setAct((prev) => {
        if (prev && list.some((u) => u.distinctId === prev)) return prev;
        const next = list[0]?.distinctId ?? "";
        if (next) writeCookie("wv_actor", next);
        return next;
      });
    } catch {
      setUsers([]);
    } finally {
      setUsersLoading(false);
    }
  }, []);

  // Re-fetch whenever the workspace changes (the roster is per workspace).
  React.useEffect(() => {
    void (async () => {
      await refreshUsers();
    })();
  }, [workspace, refreshUsers]);

  const setWorkspace = React.useCallback((slug: WorkspaceSlug) => {
    setWs(slug);
    writeCookie("wv_workspace", slug);
    // The new workspace has a different roster — show loading + clear the actor;
    // refreshUsers (triggered by the workspace change) resolves it to a valid user.
    setUsersLoading(true);
    setAct("");
  }, []);

  const ws = getWorkspace(workspace);
  const accentStyle = {
    "--primary": ws.accent,
    "--primary-foreground": ws.accentForeground,
    "--ring": ws.accent,
    "--sidebar-primary": ws.accent,
    "--sidebar-primary-foreground": ws.accentForeground,
  } as React.CSSProperties;

  return (
    <WorkspaceContext.Provider
      value={{ workspace, setWorkspace, actorId, setActorId, users, usersLoading, refreshUsers }}
    >
      <TooltipProvider delayDuration={200}>
        <div style={accentStyle} className="flex min-h-svh flex-col">
          {children}
        </div>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </WorkspaceContext.Provider>
  );
}

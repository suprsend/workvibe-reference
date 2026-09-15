"use client";

import * as React from "react";
import { Building2 } from "lucide-react";
import { NO_WORKSPACE_MESSAGE, type WorkspaceView } from "@/lib/workspaces";
import { useWorkspace } from "@/components/providers";
import { EmptyState } from "@/components/shared/empty-state";

interface ShellState {
  workspaces: WorkspaceView[];
  /** The picked workspace, else the first connected one. Null when none is connected. */
  active: WorkspaceView | null;
  error: string | null;
}

const ShellContext = React.createContext<ShellState>({ workspaces: [], active: null, error: null });

export function useWorkspaces(): ShellState {
  return React.useContext(ShellContext);
}

/**
 * Holds the live workspace list for the Admin and User screens, and themes them with
 * the active workspace's brand colour. The list is passed in by those layouts rather
 * than the root one, so the demo password page never receives it.
 */
export function WorkspaceShell({
  workspaces,
  error,
  children,
}: {
  workspaces: WorkspaceView[];
  error: string | null;
  children: React.ReactNode;
}) {
  const { workspace } = useWorkspace();
  // Same rule as getActiveWorkspace on the server, so both sides agree without a cookie write.
  const active = workspaces.find((w) => w.slug === workspace) ?? workspaces[0] ?? null;
  const style =
    active?.accent && active.accentForeground
      ? ({
          "--primary": active.accent,
          "--primary-foreground": active.accentForeground,
          "--ring": active.accent,
          "--sidebar-primary": active.accent,
          "--sidebar-primary-foreground": active.accentForeground,
        } as React.CSSProperties)
      : undefined;

  return (
    <ShellContext.Provider value={{ workspaces, active, error }}>
      <div style={style} className="flex min-h-svh flex-col">
        {children}
      </div>
    </ShellContext.Provider>
  );
}

/** Renders the page only when a workspace is connected; otherwise says how to connect one. */
export function WorkspaceRequired({ children }: { children: React.ReactNode }) {
  const { active, error } = useWorkspaces();
  if (active) return <>{children}</>;
  return (
    <EmptyState
      icon={Building2}
      title={error ? "Couldn’t read your workspaces" : "No workspace connected"}
      description={error ?? NO_WORKSPACE_MESSAGE}
    />
  );
}

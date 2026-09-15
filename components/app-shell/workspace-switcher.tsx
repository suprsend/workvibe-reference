"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/components/providers";
import { useWorkspaces } from "@/components/app-shell/workspace-shell";
import type { WorkspaceView } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

function Tile({ ws, className }: { ws: WorkspaceView; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold",
        !ws.accent && "bg-muted text-foreground",
        className,
      )}
      style={ws.accent ? { backgroundColor: ws.accent, color: ws.accentForeground ?? undefined } : undefined}
    >
      {ws.initial}
    </span>
  );
}

export function WorkspaceSwitcher() {
  const { setWorkspace } = useWorkspace();
  const { workspaces, active } = useWorkspaces();

  if (!active) return <span className="px-2 text-sm text-muted-foreground">No workspace</span>;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <Tile ws={active} />
        <span className="max-w-32 truncate">{active.name}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspace</DropdownMenuLabel>
        {workspaces.map((ws) => (
          <DropdownMenuItem key={ws.slug} onSelect={() => setWorkspace(ws.slug)} className="gap-2">
            <Tile ws={ws} />
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium leading-tight">{ws.name}</span>
              <span className="truncate text-xs text-muted-foreground leading-tight">{ws.slug}</span>
            </span>
            {ws.slug === active.slug && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

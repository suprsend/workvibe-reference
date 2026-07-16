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
import { WORKSPACES, getWorkspace } from "@/lib/workspaces";
import { cn } from "@/lib/utils";

function Tile({ initial, accent, fg, className }: { initial: string; accent: string; fg: string; className?: string }) {
  return (
    <span
      className={cn("flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold", className)}
      style={{ backgroundColor: accent, color: fg }}
    >
      {initial}
    </span>
  );
}

export function WorkspaceSwitcher() {
  const { workspace, setWorkspace } = useWorkspace();
  const active = getWorkspace(workspace);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <Tile initial={active.initial} accent={active.accent} fg={active.accentForeground} />
        <span className="max-w-32 truncate">{active.label}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspace</DropdownMenuLabel>
        {WORKSPACES.map((ws) => (
          <DropdownMenuItem
            key={ws.slug}
            onSelect={() => setWorkspace(ws.slug)}
            className="gap-2"
          >
            <Tile initial={ws.initial} accent={ws.accent} fg={ws.accentForeground} />
            <span className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{ws.label}</span>
              <span className="text-xs text-muted-foreground leading-tight">{ws.fullName}</span>
            </span>
            {ws.slug === workspace && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

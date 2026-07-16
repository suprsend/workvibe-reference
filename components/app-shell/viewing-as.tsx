"use client";

import { Check, ChevronsUpDown, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/components/providers";

export function ViewingAs() {
  const { actorId, setActorId, users, usersLoading } = useWorkspace();
  const current = users.find((u) => u.distinctId === actorId) ?? users[0];

  if (usersLoading && !current) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-muted-foreground">
        <User className="size-4" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!current) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
        <User className="size-4 text-muted-foreground" />
        <span className="text-muted-foreground">Viewing as</span>
        <span className="font-medium">{current.name}</span>
        <ChevronsUpDown className="size-4 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Employee</DropdownMenuLabel>
        {users.map((e) => (
          <DropdownMenuItem key={e.distinctId} onSelect={() => setActorId(e.distinctId)} className="gap-2">
            <span className="flex flex-col">
              <span className="text-sm font-medium leading-tight">{e.name}</span>
              <span className="text-xs text-muted-foreground leading-tight">{e.role ?? e.email ?? e.distinctId}</span>
            </span>
            {e.distinctId === current.distinctId && <Check className="ml-auto size-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

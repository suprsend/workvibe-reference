"use client";

import { usePathname } from "next/navigation";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { ViewSwitcher } from "./view-switcher";
import { ViewingAs } from "./viewing-as";

export function TopBar() {
  const pathname = usePathname();
  const isUser = pathname.startsWith("/user");

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
      <span className="text-sm font-semibold tracking-tight">WorkVibe</span>
      <Separator orientation="vertical" className="h-5" />
      <WorkspaceSwitcher />

      <div className="ml-2">
        <ViewSwitcher />
      </div>

      <div className="ml-auto flex items-center gap-3">
        {isUser && <ViewingAs />}
        <Avatar className="size-8">
          <AvatarFallback className="bg-muted text-xs">YM</AvatarFallback>
        </Avatar>
      </div>
    </header>
  );
}

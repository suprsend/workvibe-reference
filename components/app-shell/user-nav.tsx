"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, SlidersHorizontal, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Inbox", href: "/user/inbox", icon: Inbox },
  { label: "Preferences", href: "/user/preferences", icon: SlidersHorizontal },
];

export function UserNav() {
  const pathname = usePathname();
  return (
    <nav className="flex items-center gap-1 border-b border-border px-4">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

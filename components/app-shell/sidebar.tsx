"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FileText,
  Workflow,
  Megaphone,
  Activity,
  BarChart3,
  SlidersHorizontal,
  Users,
  Palette,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}
interface NavGroup {
  label?: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    label: "Notification Settings",
    items: [
      { label: "Templates", href: "/admin/templates", icon: FileText },
      { label: "Workflows", href: "/admin/workflows", icon: Workflow },
      { label: "Broadcast", href: "/admin/broadcast", icon: Megaphone },
      { label: "Executions", href: "/admin/executions", icon: Activity },
      { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Preference defaults", href: "/admin/preferences/defaults", icon: SlidersHorizontal },
      { label: "Brand Settings", href: "/admin/brand", icon: Palette },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-border px-3 py-5 md:flex">
      {NAV.map((group, i) => (
        <div key={i} className="flex flex-col gap-1">
          {group.label && (
            <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
          )}
          {group.items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </aside>
  );
}

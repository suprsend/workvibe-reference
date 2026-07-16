"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const ADMIN_HOME = "/admin/templates";
const USER_HOME = "/user/inbox";

export function ViewSwitcher() {
  const pathname = usePathname();
  const router = useRouter();
  const isUser = pathname.startsWith("/user");

  const options = [
    { key: "admin", label: "Admin", href: ADMIN_HOME, active: !isUser },
    { key: "user", label: "User", href: USER_HOME, active: isUser },
  ];

  return (
    <div className="inline-flex items-center rounded-lg bg-muted p-0.5 text-sm">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => router.push(o.href)}
          className={cn(
            "rounded-md px-3 py-1 font-medium transition-colors",
            o.active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
          aria-pressed={o.active}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

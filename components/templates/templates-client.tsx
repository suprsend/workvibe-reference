"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  FileText,
  Mail,
  Bell,
  MessageSquare,
  MessageCircle,
  Pencil,
  PenSquare,
  Trash2,
} from "lucide-react";
import { SlackIcon } from "@/components/icons/slack-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TemplateRow {
  slug: string;
  name: string;
  description?: string | null;
  enabled_channels?: string[];
  updated_at?: string;
}

const CHANNEL_META: { key: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "email", label: "Email", icon: Mail },
  { key: "inbox", label: "Inbox", icon: Bell },
  { key: "sms", label: "SMS", icon: MessageSquare },
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "slack", label: "Slack", icon: SlackIcon },
];

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

// Remount the body per workspace so each gets a fresh fetch + skeleton, with no
// synchronous state resets inside an effect.
export function TemplatesClient() {
  const { workspace } = useWorkspace();
  return <TemplatesBody key={workspace} />;
}

function TemplatesBody() {
  const router = useRouter();
  const [rows, setRows] = React.useState<TemplateRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    try {
      const res = await fetch("/api/templates", { cache: "no-store" });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Couldn’t load templates.");
        setRows([]);
      } else {
        setError(null);
        setRows(data.templates);
      }
    } catch {
      setError("Couldn’t reach SuprSend.");
      setRows([]);
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/templates", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!data.ok) {
          setError(data.error ?? "Couldn’t load templates.");
          setRows([]);
        } else {
          setRows(data.templates);
        }
      } catch {
        if (active) {
          setError("Couldn’t reach SuprSend.");
          setRows([]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const fresh = rows !== null;

  async function remove(slug: string, name: string) {
    const res = await fetch(`/api/templates?slug=${encodeURIComponent(slug)}`, { method: "DELETE" });
    const data = await res.json();
    if (data.ok) {
      toast.success("Template deleted", { description: name });
      reload();
    } else {
      toast.error("Couldn’t delete template");
    }
  }

  return (
    <>
      <PageHeader
        title="Templates"
        description="The messages your workflows send — email and in-app inbox."
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!fresh ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : rows!.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create a template in the SuprSend dashboard, then open it here to edit its email and inbox copy in the embedded editor."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <div className="grid grid-cols-[minmax(0,1fr)_9rem_5rem_4rem] items-center gap-4 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>Name</span>
            <span className="text-right">Channels</span>
            <span className="text-right">Updated</span>
            <span className="sr-only">Actions</span>
          </div>
          {rows!.map((t) => (
            <div
              key={t.slug}
              className="grid grid-cols-[minmax(0,1fr)_9rem_5rem_4rem] items-center gap-4 border-b border-border px-4 py-3 last:border-0 hover:bg-muted/20"
            >
              <Link href={`/admin/templates/${t.slug}`} className="min-w-0">
                <div className="truncate text-sm font-medium hover:underline">{t.name}</div>
                <code className="text-xs text-muted-foreground">{t.slug}</code>
              </Link>
              <TooltipProvider>
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  {CHANNEL_META.filter((c) => t.enabled_channels?.includes(c.key)).map((c) => {
                    const Icon = c.icon;
                    return (
                      <Tooltip key={c.key}>
                        <TooltipTrigger asChild>
                          <span className="flex size-7 items-center justify-center rounded-md border border-border bg-muted/40 text-muted-foreground">
                            <Icon className="size-3.5" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{c.label}</TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </TooltipProvider>
              <span className="text-right text-xs text-muted-foreground">{timeAgo(t.updated_at)}</span>
              <div className="flex items-center justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" title="Edit" aria-label="Edit">
                      <Pencil className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => router.push(`/admin/templates/${t.slug}`)}>
                      <PenSquare className="size-4" /> Open editor
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onSelect={() => remove(t.slug, t.name)}>
                      <Trash2 className="size-4" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

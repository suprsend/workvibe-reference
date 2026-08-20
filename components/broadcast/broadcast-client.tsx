"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Megaphone, Send, SquareArrowOutUpRight, Tag, Users } from "lucide-react";
import { useWorkspace } from "@/components/providers";
import { resolveBroadcastCategory } from "@/lib/broadcast";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface BroadcastTemplateOption {
  slug: string;
  name: string;
  description: string;
  category: string;
}
interface CategoryOption {
  category: string;
  name: string;
}
interface Options {
  templates: BroadcastTemplateOption[];
  categories: CategoryOption[];
  listId: string;
}

export function BroadcastClient() {
  const { workspace } = useWorkspace();
  return <Body key={workspace} />;
}

function Body() {
  const [options, setOptions] = React.useState<Options | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState("");
  const [confirming, setConfirming] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/broadcast", { cache: "no-store" });
        const data = await res.json();
        if (!active) return;
        if (!data.ok) {
          setError(data.error ?? "Couldn’t load broadcast options.");
          setOptions({ templates: [], categories: [], listId: "" });
          return;
        }
        setOptions({ templates: data.templates, categories: data.categories, listId: data.listId });
        if (data.templates[0]) setSlug(data.templates[0].slug);
      } catch {
        if (active) {
          setError("Couldn’t reach SuprSend.");
          setOptions({ templates: [], categories: [], listId: "" });
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const template = options?.templates.find((t) => t.slug === slug) ?? null;
  const category = resolveBroadcastCategory(template, options?.categories ?? []);

  async function send() {
    if (!template || !category) return;
    setSending(true);
    try {
      // No payload: /api/broadcast fills every variable from the template's own
      // sample data, the same way the workflow Send test does.
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: template.slug, category: category.category }),
      });
      const d = await res.json();
      if (d.ok) {
        setConfirming(false);
        toast.success("Broadcast sent", {
          description: `${template.name} → every subscriber on ${d.listId}.`,
        });
      } else {
        toast.error("Couldn’t send broadcast", { description: d.error });
      }
    } catch {
      toast.error("Couldn’t reach SuprSend.");
    } finally {
      setSending(false);
    }
  }


  return (
    <>
      <PageHeader
        title="Broadcast"
        description="Send one template to every subscriber at once — no workflow, no per-person trigger."
      />

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</div>
      )}

      {options === null ? (
        <div className="max-w-2xl space-y-3">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      ) : options.templates.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No broadcast templates yet"
          description="A broadcast sends a promotional template to the whole subscriber list. Publish one for this workspace and it shows up here."
        />
      ) : (
        <div className="max-w-2xl space-y-5">
          <Field label="Template">
            <div className="flex items-center gap-2">
              <select
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-2 text-sm"
              >
                {options.templates.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
              {template && (
                <Button asChild variant="outline" size="sm" className="shrink-0 gap-1.5">
                  <Link href={`/admin/templates/${template.slug}`}>
                    View message <SquareArrowOutUpRight className="size-3.5" />
                  </Link>
                </Button>
              )}
            </div>
            {template?.description && (
              <p className="text-xs text-muted-foreground">{template.description}</p>
            )}
          </Field>

          <Field label="Category">
            {category ? (
              <>
                <p className="flex items-center gap-1.5 text-sm">
                  <Tag className="size-3.5 text-muted-foreground" /> {category.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  Set by the template. Promotional only — subscribers opted out of this category won’t
                  receive it.
                </p>
              </>
            ) : (
              <p className="text-xs text-destructive">
                This template is registered under <code>{template?.category}</code>, which isn’t a
                promotional category in this workspace — so there is nothing it can legally send under.
                Add or rename it in Preference defaults first.
              </p>
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border pt-5">
            <Button onClick={() => setConfirming(true)} disabled={!template || !category}>
              <Send className="size-4" /> Review and send
            </Button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-3.5" /> Every subscriber on{" "}
              <code className="text-xs">{options.listId}</code>
            </span>
          </div>
        </div>
      )}

      <Dialog open={confirming} onOpenChange={(o) => !o && setConfirming(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send this broadcast?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <div className="rounded-lg border border-border p-3">
              <div className="font-medium">{template?.name}</div>
              <code className="text-xs text-muted-foreground">{template?.slug}</code>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="gap-1">
                  <Tag className="size-3" /> {category?.name}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <Users className="size-3" /> {options?.listId}
                </Badge>
              </div>
            </div>
            <p className="text-muted-foreground">
              This sends immediately to everyone on the list, on every channel the template has enabled.
              It can’t be recalled.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={send} disabled={sending}>
              <Send className="size-4" /> {sending ? "Sending…" : "Send broadcast"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="text-sm font-medium">{label}</h2>
      {children}
    </section>
  );
}

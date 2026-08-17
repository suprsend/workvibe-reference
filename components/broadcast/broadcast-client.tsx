"use client";

import * as React from "react";
import { toast } from "sonner";
import { Megaphone, Plus, Send, Tag, Trash2, Users } from "lucide-react";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  sampleData: Record<string, string>;
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

/** One editable merge variable row. */
interface Variable {
  key: string;
  value: string;
}

function toVariables(t: BroadcastTemplateOption): Variable[] {
  return Object.entries(t.sampleData ?? {}).map(([key, value]) => ({ key, value }));
}

// A template's default category is what the app expects; the dropdown is what the
// workspace actually has. SuprSend derives a category's slug from its NAME and
// ignores the slug it was seeded with, so a default can drift out of the live tree
// — fall back to the first real category rather than leaving the select showing one
// option while holding another, which submits a slug the API then rejects.
function resolveCategory(preferred: string, categories: CategoryOption[]): string {
  if (categories.some((c) => c.category === preferred)) return preferred;
  return categories[0]?.category ?? "";
}

export function BroadcastClient() {
  const { workspace } = useWorkspace();
  return <Body key={workspace} />;
}

function Body() {
  const [options, setOptions] = React.useState<Options | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [slug, setSlug] = React.useState("");
  const [category, setCategory] = React.useState("");
  const [vars, setVars] = React.useState<Variable[]>([]);
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
        const first: BroadcastTemplateOption | undefined = data.templates[0];
        if (first) {
          setSlug(first.slug);
          setCategory(resolveCategory(first.category, data.categories));
          setVars(toVariables(first));
        }
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

  // Choosing a template resets the category to its default and reseeds the payload
  // from that template's sample values — a payload from another template would
  // leave the new one's variables unresolved.
  function pick(t: BroadcastTemplateOption) {
    setSlug(t.slug);
    setCategory(resolveCategory(t.category, options?.categories ?? []));
    setVars(toVariables(t));
  }

  const template = options?.templates.find((t) => t.slug === slug) ?? null;

  async function send() {
    if (!template) return;
    setSending(true);
    try {
      const data: Record<string, string> = {};
      for (const v of vars) {
        if (v.key.trim()) data[v.key.trim()] = v.value;
      }
      const res = await fetch("/api/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: template.slug, category, data }),
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

  const categoryName = options?.categories.find((c) => c.category === category)?.name ?? category;

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
        <div className="space-y-3">
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
        <div className="max-w-2xl space-y-6">
          {/* 1 — template */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">1. Pick a template</h2>
            <div className="flex flex-col gap-2">
              {options.templates.map((t) => (
                <button
                  key={t.slug}
                  onClick={() => pick(t)}
                  className={`rounded-lg border px-4 py-3 text-left transition-colors ${
                    t.slug === slug ? "border-primary bg-accent/60" : "border-border hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{t.name}</span>
                    <Badge variant="outline">Promotional</Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>
                  <code className="text-xs text-muted-foreground">{t.slug}</code>
                </button>
              ))}
            </div>
          </section>

          {/* 2 — category */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">2. Send under</h2>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-sm"
            >
              {options.categories.map((c) => (
                <option key={c.category} value={c.category}>
                  {c.name} · {c.category}
                </option>
              ))}
            </select>
            {options.categories.length === 0 && (
              <p className="text-xs text-destructive">
                This workspace has no promotional categories, so there’s nothing a broadcast can legally send
                under. Add one in Preference defaults first.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Promotional categories only — a broadcast on a transactional or system category holds up that
              category’s other traffic. Subscribers who opted out of this category won’t receive it.
            </p>
          </section>

          {/* 3 — payload */}
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">3. Variables (optional)</h2>
            <p className="text-xs text-muted-foreground">
              Prefilled from the template’s sample values. Anything you leave out falls back to those samples,
              so the template always renders.
            </p>
            <div className="space-y-2">
              {vars.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={v.key}
                    onChange={(e) => setVars((rows) => rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                    placeholder="variable"
                    className="h-9 w-48 font-mono text-xs"
                  />
                  <Input
                    value={v.value}
                    onChange={(e) => setVars((rows) => rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                    placeholder="value"
                    className="h-9 flex-1"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${v.key || "variable"}`}
                    onClick={() => setVars((rows) => rows.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setVars((rows) => [...rows, { key: "", value: "" }])}>
                <Plus className="size-4" /> Add variable
              </Button>
            </div>
          </section>

          {/* 4 — send */}
          <div className="flex items-center gap-3 border-t border-border pt-5">
            <Button onClick={() => setConfirming(true)} disabled={!template || !category}>
              <Send className="size-4" /> Review and send
            </Button>
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Users className="size-3.5" /> Goes to every subscriber on <code className="text-xs">{options.listId}</code>
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
                  <Tag className="size-3" /> {categoryName}
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

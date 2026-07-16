"use client";

import * as React from "react";
import { AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { WorkflowCanvas } from "@/components/workflows/workflow-canvas";
import type { Workflow } from "@/lib/wf/derive";

export function WorkflowDetailDialog({
  slug,
  open,
  onOpenChange,
}: {
  slug: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        {open && slug ? <DetailBody key={slug} slug={slug} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailBody({ slug }: { slug: string }) {
  const [current, setCurrent] = React.useState<Workflow | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/workflows?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
        const d = await res.json();
        if (!active) return;
        if (d.ok) setCurrent(d.workflow);
        else setError(d.error ?? "Couldn’t load workflow.");
      } catch {
        if (active) setError("Couldn’t reach SuprSend.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {current?.name ?? "Workflow"}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-normal text-muted-foreground">{slug}</code>
        </DialogTitle>
        <DialogDescription>The steps this journey runs — triggers, waits, and sends.</DialogDescription>
      </DialogHeader>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : current ? (
        <WorkflowCanvas workflow={current} height={420} />
      ) : null}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}
    </>
  );
}

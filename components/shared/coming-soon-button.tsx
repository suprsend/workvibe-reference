"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Plus, Sparkles } from "lucide-react";

export function ComingSoonButton({
  label,
  variant = "default",
  ai = false,
}: {
  label: string;
  variant?: "default" | "outline";
  ai?: boolean;
}) {
  return (
    <Button
      variant={variant}
      onClick={() => toast("Lands in Phase 2", { description: `${label} isn’t wired yet — this is the foundation shell.` })}
    >
      {ai ? <Sparkles className="size-4" /> : <Plus className="size-4" />}
      {label}
    </Button>
  );
}

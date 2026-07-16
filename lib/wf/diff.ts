// Plain-English diff between the current workflow and an AI-proposed edit, so a
// reviewer can SEE exactly what the AI changed (and catch a misinterpretation)
// before publishing. Workflows are small, so we flatten each to an ordered list
// of human-readable step lines + a handful of settings, then compare.
import type { Workflow, WfNode } from "@/lib/wf/derive";

function fmtDelay(v: string): string {
  const m = String(v).match(/^(\d+)\s*([smhdw])$/i);
  if (!m) return String(v);
  const n = Number(m[1]);
  const unit = { s: "second", m: "minute", h: "hour", d: "day", w: "week" }[m[2].toLowerCase()] ?? "";
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

/** Ordered, human-readable step lines for a workflow's tree. */
export function flattenSteps(wf: Workflow): string[] {
  const out: string[] = [];
  walk(wf.tree?.nodes ?? [], out, "");
  return out;
}

function walk(nodes: WfNode[], out: string[], prefix: string) {
  for (const n of nodes) {
    const p = n.properties ?? {};
    switch (n.node_type) {
      case "send_multi_channel":
        out.push(`${prefix}Send “${String(p.template ?? "—")}”`);
        break;
      case "send_email":
        out.push(`${prefix}Send Email “${String(p.template ?? "—")}”`);
        break;
      case "send_inbox":
        out.push(`${prefix}Send Inbox “${String(p.template ?? "—")}”`);
        break;
      case "send_sms":
        out.push(`${prefix}Send SMS “${String(p.template ?? "—")}”`);
        break;
      case "send_slack":
        out.push(`${prefix}Send Slack “${String(p.template ?? "—")}”`);
        break;
      case "delay":
        out.push(`${prefix}Wait ${fmtDelay(String(p.value ?? ""))}`);
        break;
      case "branch_waituntil": {
        const cond = (n.branches ?? []).find((b) => !b.is_default);
        const def = (n.branches ?? []).find((b) => b.is_default);
        const evt = ((cond?.conditions?.[0] as { event_name?: string })?.event_name) ?? "a response";
        const wait = ((def?.conditions?.[0] as { delay_properties?: { value?: string } })?.delay_properties?.value) ?? "";
        out.push(`${prefix}Wait up to ${fmtDelay(wait)} for ${evt}`);
        walk(def?.nodes ?? [], out, `${prefix}↳ if no response: `);
        break;
      }
      case "branch": {
        out.push(`${prefix}Branch on data:`);
        for (const b of n.branches ?? []) walk(b.nodes ?? [], out, `${prefix}↳ ${b.name ?? "path"}: `);
        break;
      }
      default:
        out.push(`${prefix}${n.node_type}`);
    }
  }
}

export interface WfDiff {
  /** Settings that changed (trigger, category, name). */
  settings: { label: string; before: string; after: string }[];
  /** Step lines with a per-line status for a Before→After view. */
  before: { text: string; removed: boolean }[];
  after: { text: string; added: boolean }[];
  changed: boolean;
}

/** Compare two workflows into a reviewable diff. */
export function diffWorkflow(current: Workflow, proposed: Workflow): WfDiff {
  const settings: WfDiff["settings"] = [];
  const cmp = (label: string, a?: string, b?: string) => {
    if ((a ?? "") !== (b ?? "")) settings.push({ label, before: a ?? "—", after: b ?? "—" });
  };
  cmp("Name", current.name, proposed.name);
  cmp("Trigger", current.trigger_type ?? "api", proposed.trigger_type ?? "api");
  cmp("Category", current.category, proposed.category);

  const beforeLines = flattenSteps(current);
  const afterLines = flattenSteps(proposed);
  const beforeSet = new Set(beforeLines);
  const afterSet = new Set(afterLines);
  const before = beforeLines.map((text) => ({ text, removed: !afterSet.has(text) }));
  const after = afterLines.map((text) => ({ text, added: !beforeSet.has(text) }));

  const changed = settings.length > 0 || before.some((l) => l.removed) || after.some((l) => l.added);
  return { settings, before, after, changed };
}

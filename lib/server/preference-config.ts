// Workspace notification-category config (the "Workspace defaults" surface).
// Self-contained ServiceToken client — does NOT touch shared workflow/template code.
//
// Source (verified): GET v1/{ws}/preference_category/ → { root_categories:[{root_category,
//   sections:[{name, categories:[{category, name, description, default_preference,
//   default_opt_in_channels, default_mandatory_channels}]}]}] }.
// Write: POST (PATCH/PUT → 405) v1/{ws}/preference_category/?commit=true — send the
//   FULL root_categories tree (exactly 3 roots). We read the live tree, apply edits
//   by slug, and POST it back so structure/sections are preserved.
import "server-only";
import type { WorkspaceSlug } from "@/lib/workspaces";

const MGMNT = (process.env.SUPRSEND_MGMNT_URL || "https://management-api.suprsend.com/").replace(/\/$/, "");

function authHeaders(): Record<string, string> {
  const token = process.env.SUPRSEND_SERVICE_TOKEN;
  if (!token) throw new Error("SUPRSEND_SERVICE_TOKEN is not set");
  return { Authorization: `ServiceToken ${token}`, "Content-Type": "application/json" };
}

export type Pref = "opt_in" | "opt_out" | "cant_unsubscribe";

interface RawCategory {
  category?: string;
  name: string;
  description?: string | null;
  default_preference: Pref;
  default_opt_in_channels?: string[] | null;
  default_mandatory_channels?: string[] | null;
}
interface RawSection {
  name?: string | null;
  description?: string | null;
  tags?: string[] | null;
  categories?: RawCategory[] | null;
}
interface RawRoot {
  root_category: "system" | "transactional" | "promotional";
  sections?: RawSection[] | null;
}
interface PrefDoc {
  root_categories: RawRoot[];
}

export interface PrefCategory {
  root: string;
  section: string;
  category: string;
  name: string;
  description: string | null;
  preference: Pref;
  optInChannels: string[];
  mandatoryChannels: string[];
}

/** One edit from the admin UI, keyed by category slug. */
export interface PrefEdit {
  category: string;
  preference: Pref;
  optInChannels: string[];
  mandatoryChannels: string[];
}

async function readDoc(ws: WorkspaceSlug): Promise<PrefDoc> {
  const res = await fetch(`${MGMNT}/v1/${ws}/preference_category/?mode=live`, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error(`preference_category read failed (${res.status})`);
  return (await res.json()) as PrefDoc;
}

export async function getPreferenceConfig(ws: WorkspaceSlug): Promise<PrefCategory[]> {
  const doc = await readDoc(ws);
  const out: PrefCategory[] = [];
  for (const root of doc.root_categories ?? []) {
    for (const sec of root.sections ?? []) {
      for (const c of sec.categories ?? []) {
        out.push({
          root: root.root_category,
          section: sec.name ?? "",
          category: c.category ?? "",
          name: c.name,
          description: c.description ?? null,
          preference: c.default_preference,
          optInChannels: c.default_opt_in_channels ?? [],
          mandatoryChannels: c.default_mandatory_channels ?? [],
        });
      }
    }
  }
  return out;
}

/** Apply edits (by slug) to the live tree and commit a new version. */
export async function savePreferenceConfig(ws: WorkspaceSlug, edits: PrefEdit[]): Promise<{ ok: boolean; status: number }> {
  const doc = await readDoc(ws);
  const bySlug = new Map(edits.map((e) => [e.category, e]));
  for (const root of doc.root_categories ?? []) {
    for (const sec of root.sections ?? []) {
      for (const c of sec.categories ?? []) {
        const e = c.category ? bySlug.get(c.category) : undefined;
        if (!e) continue;
        const cantUnsub = e.preference === "cant_unsubscribe";
        c.default_preference = e.preference;
        // Always set the on-by-default channel set. For a Required (cant_unsubscribe)
        // category, ALSO mark those channels mandatory (locked). Verified empirically:
        // setting ONLY mandatory left the other channels on+editable for new hires —
        // setting opt_in too turns the UNSELECTED channels OFF by default (the
        // intuitive result). For opt_out, SuprSend ignores opt_in channels anyway.
        c.default_opt_in_channels = e.optInChannels;
        c.default_mandatory_channels = cantUnsub ? e.mandatoryChannels : null;
      }
    }
  }
  const res = await fetch(
    `${MGMNT}/v1/${ws}/preference_category/?commit=true&commit_message=${encodeURIComponent("Updated from WorkVibe")}`,
    { method: "POST", headers: authHeaders(), body: JSON.stringify({ root_categories: doc.root_categories }) },
  );
  return { ok: res.ok, status: res.status };
}

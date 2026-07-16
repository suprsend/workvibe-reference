import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { getUser } from "@/lib/server/users";
import { getUserCategories, updateUserCategory } from "@/lib/server/subscriber-prefs";

// The "viewing as" employee's OWN preferences. Synchronous hub PATCH (no client
// debounce) so a toggle persists even on immediate navigation. The actor is a
// LIVE SuprSend subscriber (the "viewing as" roster) — validate against the hub.
async function valid(ws: Parameters<typeof getUser>[0], distinctId: string | null) {
  if (!distinctId) return null;
  return getUser(ws, distinctId);
}

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const distinctId = new URL(req.url).searchParams.get("distinct_id");
    if (!(await valid(ws, distinctId))) {
      return NextResponse.json({ ok: false, error: "Unknown employee for this workspace." }, { status: 400 });
    }
    const categories = await getUserCategories(ws, distinctId!);
    return NextResponse.json({ ok: true, categories });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { distinct_id, category, preference, opt_out_channels } = await req.json();
    if (!(await valid(ws, distinct_id))) {
      return NextResponse.json({ ok: false, error: "Unknown employee for this workspace." }, { status: 400 });
    }
    if (!category || (preference !== "opt_in" && preference !== "opt_out")) {
      return NextResponse.json({ ok: false, error: "category + valid preference required" }, { status: 400 });
    }
    const result = await updateUserCategory(ws, distinct_id, category, preference, Array.isArray(opt_out_channels) ? opt_out_channels : []);
    return NextResponse.json({ ok: result.ok, status: result.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}


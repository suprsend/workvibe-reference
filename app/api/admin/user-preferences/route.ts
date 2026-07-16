import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { getUserCategories, updateUserCategory } from "@/lib/server/subscriber-prefs";

// Admin-scoped: accepts any live subscriber distinct_id in the active workspace
// (the Users tab passes ids from the live user list, not just the seed employees).
export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const distinctId = new URL(req.url).searchParams.get("distinct_id");
    if (!distinctId) {
      return NextResponse.json({ ok: false, error: "distinct_id required" }, { status: 400 });
    }
    const categories = await getUserCategories(ws, distinctId);
    return NextResponse.json({ ok: true, categories });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { distinct_id, category, preference, opt_out_channels } = await req.json();
    if (!distinct_id) {
      return NextResponse.json({ ok: false, error: "distinct_id required" }, { status: 400 });
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


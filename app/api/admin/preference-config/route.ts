import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { getPreferenceConfig, savePreferenceConfig, type PrefEdit } from "@/lib/server/preference-config";

export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    const categories = await getPreferenceConfig(ws.slug);
    return NextResponse.json({ ok: true, categories });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { edits } = (await req.json()) as { edits: PrefEdit[] };
    if (!Array.isArray(edits)) return NextResponse.json({ ok: false, error: "edits[] required" }, { status: 400 });
    const result = await savePreferenceConfig(ws.slug, edits);
    return NextResponse.json({ ok: result.ok, status: result.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}


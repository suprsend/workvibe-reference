import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { getSubscriberList } from "@/lib/server/lists";
import { ALL_SUBSCRIBERS_LIST } from "@/lib/server/users";

// The broadcast audience. One list in this app, so it's fetched by name rather
// than enumerated — a workspace can hold many, and listing them is a separate call.
export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    const list = await getSubscriberList(ws, ALL_SUBSCRIBERS_LIST);
    return NextResponse.json({ ok: true, list });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

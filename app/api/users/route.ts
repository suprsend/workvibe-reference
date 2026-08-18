import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { listUsers, removeUser } from "@/lib/server/users";

export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    const users = await listUsers(ws);
    return NextResponse.json({ ok: true, users });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const id = new URL(req.url).searchParams.get("distinct_id");
    if (!id) return NextResponse.json({ ok: false, error: "distinct_id required" }, { status: 400 });
    await removeUser(ws, id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

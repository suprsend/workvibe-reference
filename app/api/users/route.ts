import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { listUsers, removeUser, createUser, ensureSubscribersList } from "@/lib/server/users";

export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    // The list is created here, before anyone is added, so its entry tracking can be
    // switched on in the dashboard first — see ensureSubscribersList.
    const [users, list] = await Promise.all([listUsers(ws), ensureSubscribersList(ws).catch(() => null)]);
    return NextResponse.json({ ok: true, users, welcomeTracking: list?.trackUserEntry ?? null });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

// Add a subscriber. Not how consumers really arrive — they sign up in the
// customer's own product — but it's how people are added in this app. Joining the
// list is what welcomes them.
export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { name, email, distinct_id } = await req.json();
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ ok: false, error: "Name is required." }, { status: 400 });
    }
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      return NextResponse.json({ ok: false, error: "A valid email is required." }, { status: 400 });
    }
    if (distinct_id != null && (typeof distinct_id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(distinct_id))) {
      return NextResponse.json({ ok: false, error: "Distinct ID may only use letters, digits, _ and -." }, { status: 400 });
    }
    const user = await createUser(ws, { name: name.trim(), email: email.trim(), distinctId: distinct_id });
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 400 });
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

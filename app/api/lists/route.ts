import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { listSubscriberLists } from "@/lib/server/lists";
import { ALL_SUBSCRIBERS_LIST } from "@/lib/server/users";

// Every list in the workspace, live — a list created in the SuprSend dashboard
// appears here too. all-subscribers is called out because it is the broadcast
// audience and the list whose entry event welcomes a new subscriber.
export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    const lists = await listSubscriberLists(ws);
    // The broadcast audience first, the rest by name.
    lists.sort((a, b) =>
      a.listId === ALL_SUBSCRIBERS_LIST ? -1 : b.listId === ALL_SUBSCRIBERS_LIST ? 1 : a.name.localeCompare(b.name),
    );
    return NextResponse.json({ ok: true, lists, broadcastListId: ALL_SUBSCRIBERS_LIST });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { broadcastToList, type BroadcastChannel } from "@/lib/server/hub";
import { ALL_SUBSCRIBERS_LIST } from "@/lib/server/users";
import { getBroadcastTemplate, getBroadcastTemplates } from "@/lib/broadcast";
import { getPreferenceConfig } from "@/lib/server/preference-config";
import { getTemplateSampleData } from "@/lib/suprsend-mgmt";

// The form's options: which templates this workspace can broadcast (with their
// sample data, which seeds the editable payload) and which categories are legal
// to send them under — the live PROMOTIONAL tree only.
export async function GET() {
  try {
    const ws = await getActiveWorkspace();
    const [templates, categories] = await Promise.all([
      Promise.all(
        getBroadcastTemplates(ws.slug).map(async (t) => ({
          ...t,
          sampleData: await getTemplateSampleData(ws.slug, t.slug).catch(() => ({})),
        })),
      ),
      getPreferenceConfig(ws.slug).then((cats) => cats.filter((c) => c.root === "promotional")),
    ]);
    return NextResponse.json({
      ok: true,
      templates,
      categories: categories.map((c) => ({ category: c.category, name: c.name })),
      listId: ALL_SUBSCRIBERS_LIST,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

// Broadcast a template to every subscriber on the all-subscribers list.
export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { template, category, data, channels } = await req.json();

    if (!template || !category) {
      return NextResponse.json({ ok: false, error: "template and category are required." }, { status: 400 });
    }
    const known = getBroadcastTemplate(ws.slug, template);
    if (!known) {
      return NextResponse.json({ ok: false, error: `“${template}” isn’t a broadcast template for this workspace.` }, { status: 400 });
    }

    // A broadcast may only run on a promotional category — on a transactional or
    // system category it delays that category's other traffic. Checked against
    // the live tree, not the registry, so an edit in Preference defaults counts.
    const promotional = (await getPreferenceConfig(ws.slug)).filter((c) => c.root === "promotional");
    if (!promotional.some((c) => c.category === category)) {
      return NextResponse.json(
        { ok: false, error: `“${category}” isn’t a promotional category. Broadcasts can only send on promotional categories.` },
        { status: 400 },
      );
    }

    // Start from the template's sample values so every merge variable resolves,
    // then layer the caller's payload on top — same guard the Send test uses
    // against "missing variable" render failures.
    const base = await getTemplateSampleData(ws.slug, template).catch(() => ({}));
    const payload = { ...base, ...(data ?? {}) };

    // broadcast() resolves with success:false on an API error rather than throwing.
    const res = await broadcastToList(ws, template, category, payload, channels as BroadcastChannel[] | undefined);
    if (!res.success) {
      return NextResponse.json({ ok: false, error: res.message || "SuprSend rejected the broadcast." }, { status: 502 });
    }
    return NextResponse.json({ ok: true, template, category, listId: ALL_SUBSCRIBERS_LIST });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

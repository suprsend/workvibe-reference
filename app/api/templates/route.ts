import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import {
  listTemplates,
  deleteTemplate,
  publishTemplate,
  getTemplateDraft,
} from "@/lib/suprsend-mgmt";
import { generatedToDraft, type GeneratedTemplate } from "@/lib/templates/draft";

const toDraft = generatedToDraft;

// Slugs are interpolated into management API URL paths, so restrict them to
// path-safe characters — otherwise "../.." walks out of the endpoint. SuprSend
// slugs may carry underscores and mixed case (a dashboard-created template is
// free to), so the charset is wider than what our own seed uses.
const SLUG_RE = /^[a-zA-Z0-9_-]+$/;

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const slug = new URL(req.url).searchParams.get("slug");
    if (slug) {
      if (!SLUG_RE.test(slug)) {
        return NextResponse.json({ ok: false, error: "Invalid template slug." }, { status: 400 });
      }
      const template = await getTemplateDraft(ws.slug, slug);
      if (!template) return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
      return NextResponse.json({ ok: true, template });
    }
    const templates = await listTemplates(ws.slug);
    return NextResponse.json({ ok: true, templates });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { mode, template } = await req.json();

    if (mode === "publish") {
      if (!template?.slug) {
        return NextResponse.json({ ok: false, error: "No template to publish." }, { status: 400 });
      }
      if (typeof template.slug !== "string" || !SLUG_RE.test(template.slug)) {
        return NextResponse.json({ ok: false, error: "Invalid template slug." }, { status: 400 });
      }
      const result = await publishTemplate(ws.slug, toDraft(template as GeneratedTemplate));
      return NextResponse.json({ ok: result.ok, status: result.status, body: result.body });
    }

    return NextResponse.json({ ok: false, error: "mode must be 'publish'." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const slug = new URL(req.url).searchParams.get("slug");
    if (!slug) return NextResponse.json({ ok: false, error: "slug required" }, { status: 400 });
    if (!SLUG_RE.test(slug)) {
      return NextResponse.json({ ok: false, error: "Invalid template slug." }, { status: 400 });
    }
    const result = await deleteTemplate(ws.slug, slug);
    return NextResponse.json({ ok: result.ok, status: result.status });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}


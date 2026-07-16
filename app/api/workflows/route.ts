import { NextResponse } from "next/server";
import { errMsg } from "@/lib/server/http";
import { getActiveWorkspace } from "@/lib/server/workspace";
import { listWorkflows, getWorkflow, publishWorkflow, publishTemplate } from "@/lib/suprsend-mgmt";
import { generatedToDraft, type GeneratedTemplate } from "@/lib/templates/draft";

interface GeneratedWorkflow {
  slug: string;
  name: string;
  description?: string;
  trigger_type: string;
  category: string;
  is_enabled?: boolean;
  tree: { nodes: Record<string, unknown>[] };
  payload_schema?: Record<string, unknown>;
}

interface Generated {
  workflow: GeneratedWorkflow;
  templates?: GeneratedTemplate[];
}

function validWorkflow(w: unknown): w is GeneratedWorkflow {
  const x = w as GeneratedWorkflow | undefined;
  return (
    !!x &&
    typeof x.slug === "string" &&
    /^[a-z0-9-]+$/.test(x.slug) &&
    typeof x.name === "string" &&
    !!x.tree &&
    Array.isArray(x.tree.nodes) &&
    x.tree.nodes.length > 0
  );
}

export async function GET(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const slug = new URL(req.url).searchParams.get("slug");
    if (slug) {
      const r = await getWorkflow(ws.slug, slug);
      if (!r.ok) return NextResponse.json({ ok: false, error: "Workflow not found." }, { status: 404 });
      return NextResponse.json({ ok: true, workflow: r.body });
    }
    const workflows = await listWorkflows(ws.slug);
    return NextResponse.json({ ok: true, workflows });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const ws = await getActiveWorkspace();
    const { mode, generated } = await req.json();

    if (mode === "publish") {
      const g = generated as Generated | undefined;
      if (!g || !validWorkflow(g.workflow)) {
        return NextResponse.json({ ok: false, error: "No workflow to publish." }, { status: 400 });
      }
      // 1) Publish every template FIRST. If any fails, do NOT publish the workflow (atomic).
      for (const t of g.templates ?? []) {
        const r = await publishTemplate(ws.slug, generatedToDraft(t));
        if (!r.ok) {
          return NextResponse.json(
            { ok: false, error: `Template "${t.slug}" failed to publish — workflow not published.`, body: r.body },
            { status: 422 },
          );
        }
      }
      // 2) Publish the workflow.
      const r = await publishWorkflow(ws.slug, g.workflow.slug, g.workflow);
      return NextResponse.json({ ok: r.ok, status: r.status, body: r.body, slug: g.workflow.slug });
    }

    return NextResponse.json({ ok: false, error: "mode must be 'publish'." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: errMsg(e) }, { status: 500 });
  }
}


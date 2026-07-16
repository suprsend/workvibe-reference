import { getActiveWorkspace } from "@/lib/server/workspace";
import { getTemplate } from "@/lib/suprsend-mgmt";
import { TemplateEditorView } from "@/components/templates/template-editor-view";

// Always render fresh — a channel added moments ago (e.g. via a workflow edit) must
// show up in the editor's tab list immediately, never a stale cached payload.
export const dynamic = "force-dynamic";

export default async function TemplateEditorPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ws = await getActiveWorkspace();
  const meta = await getTemplate(ws.slug, slug);
  const channels = meta.ok && meta.body.enabled_channels ? meta.body.enabled_channels : [];
  const name = meta.ok && meta.body.name ? meta.body.name : slug;
  return <TemplateEditorView slug={slug} channels={channels} name={name} />;
}

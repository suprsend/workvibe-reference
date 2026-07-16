import type { TemplateDraft } from "@/lib/suprsend-mgmt";

/** Shape the AI emits for a template (snake_case from the model). */
export interface GeneratedTemplate {
  slug: string;
  name: string;
  description?: string;
  channels?: string[];
  email?: { subject: string; html: string };
  inbox?: { title: string; body: string; button?: { text: string; url: string } };
  sms?: { body: string };
  whatsapp?: { body: string };
  slack?: { blocks?: Record<string, unknown>[]; body?: string };
  sample_data?: Record<string, string>;
  sampleData?: Record<string, string>;
}

const text = (c?: { body?: string }) => (c && c.body ? { body: c.body } : undefined);

/** Convert the AI's template JSON into the publish-ready TemplateDraft. */
export function generatedToDraft(g: GeneratedTemplate): TemplateDraft {
  return {
    slug: g.slug,
    name: g.name,
    description: g.description,
    email: g.email && g.email.subject && g.email.html ? g.email : undefined,
    inbox:
      g.inbox && g.inbox.title && g.inbox.body
        ? {
            title: g.inbox.title,
            body: g.inbox.body,
            button: g.inbox.button?.text && g.inbox.button?.url ? g.inbox.button : undefined,
          }
        : undefined,
    sms: text(g.sms),
    whatsapp: text(g.whatsapp),
    slack: g.slack?.blocks?.length ? { blocks: g.slack.blocks } : undefined,
    sampleData: g.sample_data ?? g.sampleData,
  };
}

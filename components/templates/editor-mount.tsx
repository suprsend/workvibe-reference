"use client";

import "@suprsend/react-editor/styles.css";
import { SuprSendTemplateProvider, TemplateEditor, type ChannelId } from "@suprsend/react-editor";

export default function EditorMount({
  workspaceUid,
  slug,
  channels,
  accessToken,
  recipient,
  primary,
}: {
  workspaceUid: string;
  slug: string;
  channels: string[];
  accessToken: string;
  recipient: string;
  primary: string;
}) {
  return (
    <SuprSendTemplateProvider
      workspaceUid={workspaceUid}
      templateSlug={slug}
      variantId="default"
      tenantId={null}
      channels={channels as ChannelId[]}
      locale="en"
      conditions={[]}
      accessToken={accessToken}
      recipientDistinctId={recipient}
      themeOverrides={{ primary }}
    >
      <TemplateEditor />
    </SuprSendTemplateProvider>
  );
}

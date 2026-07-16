"use client";

import { SuprSendProvider, SuprSendFeedProvider, NotificationFeed } from "@suprsend/react";

// SuprSend's inline feed needs TWO providers: SuprSendProvider (auth) AND
// SuprSendFeedProvider (which configures the tenant + stores and actually FETCHES
// the feed). NotificationFeed alone only renders chrome — no fetch — so the inbox
// stays empty. `<Inbox>` (the bell popover) bundles the feed provider internally;
// for a full-page inline feed we wire SuprSendFeedProvider ourselves.
//
// tenantId MUST match the tenant the notifications were sent to ("default" — our
// trigger uses tenant_id:"default"); otherwise the feed queries the wrong tenant
// and returns nothing.
const STORES = [
  { storeId: "all", label: "All" },
  { storeId: "unread", label: "Unread", query: { read: false } },
];

// Theme the embedded feed to match WorkVibe: Geist font + the app's design tokens
// (CSS variables), so it adopts the active workspace's accent (SpaceX blue / Uber
// black) and our typography instead of SuprSend's default look.
const FONT = "var(--font-sans), ui-sans-serif, system-ui, sans-serif";
const FEED_THEME = {
  header: {
    container: { borderBottom: "1px solid var(--border)", paddingLeft: 0, paddingRight: 0 },
    headerText: { fontFamily: FONT, color: "var(--foreground)", fontWeight: 600 },
    markAllReadText: { fontFamily: FONT, color: "var(--primary)", fontWeight: 500 },
  },
  tabs: {
    color: "var(--primary)",
    unselectedColor: "var(--muted-foreground)",
    bottomColor: "var(--primary)",
    badgeColor: "var(--primary)",
    badgeText: "var(--primary-foreground)",
  },
  notificationsContainer: {
    noNotificationsText: { fontFamily: FONT, color: "var(--foreground)" },
    noNotificationsSubtext: { fontFamily: FONT, color: "var(--muted-foreground)" },
    loader: { color: "var(--primary)" },
  },
  notification: {
    container: { borderBottom: "1px solid var(--border)", hoverBackgroundColor: "var(--accent)", unreadBackgroundColor: "transparent" },
    headerText: { fontFamily: FONT, color: "var(--foreground)", fontWeight: 600 },
    bodyText: { fontFamily: FONT, color: "var(--muted-foreground)", linkColor: "var(--primary)" },
    createdOnText: { fontFamily: FONT, color: "var(--muted-foreground)" },
    subtext: { fontFamily: FONT, color: "var(--muted-foreground)" },
    unseenDot: { backgroundColor: "var(--primary)" },
    actions: [
      { container: { backgroundColor: "var(--primary)", borderRadius: 6 }, text: { color: "var(--primary-foreground)", fontFamily: FONT, fontWeight: 500 } },
      { container: { backgroundColor: "transparent", border: "1px solid var(--border)", borderRadius: 6 }, text: { color: "var(--foreground)", fontFamily: FONT, fontWeight: 500 } },
    ],
  },
};

export default function InboxMount({
  publicApiKey,
  distinctId,
  userToken,
}: {
  publicApiKey: string;
  distinctId: string;
  userToken: string;
}) {
  return (
    <SuprSendProvider publicApiKey={publicApiKey} distinctId={distinctId} userToken={userToken}>
      <SuprSendFeedProvider tenantId="default" stores={STORES}>
        <NotificationFeed pagination theme={FEED_THEME} />
      </SuprSendFeedProvider>
    </SuprSendProvider>
  );
}

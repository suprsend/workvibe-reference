"use client";

import { Bell } from "lucide-react";
import { useWorkspace } from "@/components/providers";
import { PageHeader } from "@/components/shared/page-header";
import { PreferenceCenter } from "@/components/preferences/preference-center";
import { SubscriberRequired } from "@/components/user/subscriber-required";

export function PreferencesClient() {
  const { workspace, actorId } = useWorkspace();
  return (
    <>
      <PageHeader title="Notification preferences" description="Choose what you hear about, and how." />
      <SubscriberRequired>
        {/* Remount per workspace + impersonated user so it loads fresh prefs. */}
        <PreferenceCenter
          key={`${workspace}:${actorId}`}
          distinctId={actorId}
          endpoint="/api/user-preferences"
          emptyIcon={Bell}
          emptyTitle="No preference categories yet"
          emptyDescription="Once your workspace defines notification categories, you’ll be able to turn each one on or off and pick channels here."
        />
      </SubscriberRequired>
    </>
  );
}

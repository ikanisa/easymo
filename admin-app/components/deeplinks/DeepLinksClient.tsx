"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { IssueDeepLinkForm } from "./IssueDeepLinkForm";

export function DeepLinksClient() {
  return (
    <div className="admin-page">
      <PageHeader
        title="Deep Links"
        description="Issue short-lived tokens that launch users directly into Insurance or QR flows."
      />

      <SectionCard
        title="Issue WhatsApp deep link"
        description="Generate a signed deeplink URL, optionally bind it to a phone number, and send it via WhatsApp."
      >
        <IssueDeepLinkForm />
      </SectionCard>
    </div>
  );
}

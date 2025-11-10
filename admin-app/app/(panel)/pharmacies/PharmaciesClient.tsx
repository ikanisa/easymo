"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MarketplaceRequestWizard } from "@/components/marketplace/MarketplaceRequestWizard";
import { MarketplaceQuoteComparison } from "@/components/marketplace/MarketplaceQuoteComparison";
import { MarketplaceThreadViewer } from "@/components/marketplace/MarketplaceThreadViewer";
import { type MarketplaceAgentSessionsQueryParams, useMarketplaceAgentSessionsQuery } from "@/lib/queries/marketplaceAgentSessions";
import { Button } from "@/components/ui/Button";

interface PharmaciesClientProps {
  initialParams: MarketplaceAgentSessionsQueryParams;
}

export function PharmaciesClient({ initialParams }: PharmaciesClientProps) {
  const [params] = useState(initialParams);
  const sessionsQuery = useMarketplaceAgentSessionsQuery(params, {
    refetchInterval: 5000,
  });

  const sessions = useMemo(() => sessionsQuery.data?.data ?? [], [sessionsQuery.data?.data]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Pharmacies"
        description="Coordinate medicine sourcing, compare vendor quotes, and monitor WhatsApp negotiation threads in one cockpit."
        actions={<Button variant="outline">Configure escalation rules</Button>}
      />

      <SectionCard
        title="New sourcing request"
        description="Launch an AI-led search for stock availability and pricing across nearby pharmacies."
      >
        <MarketplaceRequestWizard
          agentType="pharmacy"
          flowType="nearby_pharmacies"
          title="AI pharmacy intake"
          description="Capture medicines, delivery coordinates, and push to the agent orchestration pipeline."
          placeholderItems={["Amoxicillin 500mg", "ORS sachets", "Vitamin C"]}
        />
      </SectionCard>

      <SectionCard
        title="Quote intelligence"
        description="Inspect the most competitive pharmacy offers by price and SLA."
      >
        <MarketplaceQuoteComparison
          sessions={sessions}
          isLoading={sessionsQuery.isLoading}
          agentLabel="Pharmacy"
        />
      </SectionCard>

      <SectionCard
        title="Conversation monitor"
        description="Review WhatsApp exchanges between EasyMO agents and pharmacy contacts."
      >
        <MarketplaceThreadViewer
          sessions={sessions}
          isLoading={sessionsQuery.isLoading}
          title="Live pharmacy threads"
          description="Auto-refreshing every few seconds from Supabase wa_threads and agent_quotes."
        />
      </SectionCard>
    </div>
  );
}

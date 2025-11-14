"use client";

import { MarketplaceRequestWizard } from "@/components/marketplace/MarketplaceRequestWizard";
import { MarketplaceQuoteComparison } from "@/components/marketplace/MarketplaceQuoteComparison";
import { MarketplaceThreadViewer } from "@/components/marketplace/MarketplaceThreadViewer";
import { type MarketplaceAgentSessionsQueryParams, useMarketplaceAgentSessionsQuery } from "@/lib/queries/marketplaceAgentSessions";
import { useMemo } from "react";
import { SectionCard } from "@/components/ui/SectionCard";
import { PropertyHighlights } from "@/components/property/PropertyHighlights";
import { PropertyDemandHeatmap } from "@/components/property/PropertyDemandHeatmap";

interface PropertyRentalsPanelProps {
  params: MarketplaceAgentSessionsQueryParams;
}

export function PropertyRentalsPanel({ params }: PropertyRentalsPanelProps) {
  const sessionsQuery = useMarketplaceAgentSessionsQuery(params, {
    refetchInterval: 7000,
  });
  const sessions = useMemo(() => sessionsQuery.data?.data ?? [], [sessionsQuery.data?.data]);

  return (
    <div className="space-y-6">
      <PropertyHighlights />
      <PropertyDemandHeatmap />
      <SectionCard
        title="Launch property search"
        description="Capture bedroom count, neighbourhood, and budget to dispatch the rental agent."
      >
        <MarketplaceRequestWizard
          agentType="property_rental"
          flowType="property_rental"
          title="Property rental intake"
          description="Sends requirement brief to the property_rental agent flow, which queries Supabase functions."
          placeholderItems={["2 bedroom apartment", "Gishushu", "Parking"]}
        />
      </SectionCard>

      <SectionCard
        title="Rental offers"
        description="Track the best property matches and pricing surfaced by the agent."
      >
        <MarketplaceQuoteComparison
          sessions={sessions}
          isLoading={sessionsQuery.isLoading}
          agentLabel="Property"
        />
      </SectionCard>

      <SectionCard
        title="Guest conversations"
        description="WhatsApp multi-thread activity for rental hunting."
      >
        <MarketplaceThreadViewer
          sessions={sessions}
          isLoading={sessionsQuery.isLoading}
          title="Property rental threads"
          description="Refreshes automatically from Supabase agent_sessions and wa_messages."
        />
      </SectionCard>
    </div>
  );
}

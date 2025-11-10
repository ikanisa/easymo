"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { MarketplaceRequestWizard } from "@/components/marketplace/MarketplaceRequestWizard";
import { MarketplaceQuoteComparison } from "@/components/marketplace/MarketplaceQuoteComparison";
import { MarketplaceThreadViewer } from "@/components/marketplace/MarketplaceThreadViewer";
import { type MarketplaceAgentSessionsQueryParams, useMarketplaceAgentSessionsQuery } from "@/lib/queries/marketplaceAgentSessions";
import { Button } from "@/components/ui/Button";

interface QuincailleriesClientProps {
  initialParams: MarketplaceAgentSessionsQueryParams;
}

export function QuincailleriesClient({ initialParams }: QuincailleriesClientProps) {
  const [params] = useState(initialParams);
  const sessionsQuery = useMarketplaceAgentSessionsQuery(params, {
    refetchInterval: 5000,
  });

  const sessions = useMemo(() => sessionsQuery.data?.data ?? [], [sessionsQuery.data?.data]);

  return (
    <div className="admin-page">
      <PageHeader
        title="Quincailleries"
        description="Track hardware sourcing, quote comparisons, and agent-led chat threads for construction supplies."
        actions={<Button variant="outline">Manage preferred vendors</Button>}
      />

      <SectionCard
        title="New hardware request"
        description="Send the AI hardware buyer to scout nearby quincailleries for availability and pricing."
      >
        <MarketplaceRequestWizard
          agentType="quincaillerie"
          flowType="nearby_quincailleries"
          title="Hardware intake wizard"
          description="Capture bill-of-material requirements and dispatch to the marketplace orchestrator."
          placeholderItems={["PVC pipes", "Cement 50kg", "Electrical cable"]}
        />
      </SectionCard>

      <SectionCard
        title="Supplier heatmap"
        description="See the strongest hardware offers emerging from current negotiations."
      >
        <MarketplaceQuoteComparison
          sessions={sessions}
          isLoading={sessionsQuery.isLoading}
          agentLabel="Hardware"
        />
      </SectionCard>

      <SectionCard
        title="Negotiation threads"
        description="Monitor WhatsApp dialogues between EasyMO and hardware vendors."
      >
        <MarketplaceThreadViewer
          sessions={sessions}
          isLoading={sessionsQuery.isLoading}
          title="Hardware vendor threads"
          description="Blends agent_sessions, vendor_quote_responses, and wa_messages for full traceability."
        />
      </SectionCard>
    </div>
  );
}

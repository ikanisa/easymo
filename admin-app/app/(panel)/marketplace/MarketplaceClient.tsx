"use client";

import { PageHeader } from "@/components/layout/PageHeader";
import { IntentsTable } from "@/components/marketplace/IntentsTable";
import { PurchasesTable } from "@/components/marketplace/PurchasesTable";
import { VendorRankingTable } from "@/components/marketplace/VendorRankingTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { SectionCard } from "@/components/ui/SectionCard";
import { useMarketplaceSummaryQuery } from "@/lib/queries/marketplace";

export function MarketplaceClient() {
  const summaryQuery = useMarketplaceSummaryQuery();

  const vendors = summaryQuery.data?.vendors ?? [];
  const intents = summaryQuery.data?.intents ?? [];
  const purchases = summaryQuery.data?.purchases ?? [];
  const integrationMessage = summaryQuery.data?.integration?.message;

  return (
    <div className="admin-page">
      <PageHeader
        title="Marketplace"
        description="Rank vendors, review intents, and audit completed purchases end-to-end."
      />

      <SectionCard
        title="Vendor ranking"
        description="Scores blend rating, fulfilment, response times, recent performance, and wallet liquidity."
      >
        {summaryQuery.isLoading
          ? (
            <LoadingState
              title="Loading vendor ranking"
              description="Fetching scores from the ranking service."
            />
          )
          : vendors.length
          ? <VendorRankingTable data={vendors} />
          : (
            <EmptyState
              title="No vendors yet"
              description="Create vendors via the vendor service to populate this view."
            />
          )}
        {integrationMessage && (
          <p className="mt-3 text-sm text-[color:var(--color-muted)]">{integrationMessage}</p>
        )}
      </SectionCard>

      <SectionCard
        title="Intent pipeline"
        description="Monitor incoming intents across channels and how many quotes each received."
      >
        {summaryQuery.isLoading
          ? (
            <LoadingState
              title="Loading intents"
              description="Fetching recent intents from buyer service."
            />
          )
          : intents.length
          ? <IntentsTable data={intents} />
          : (
            <EmptyState
              title="No recent intents"
              description="Once marketing automations go live, intents will appear here."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Recent purchases"
        description="Completed journeys trigger wallet transfers and appear here for reconciliation."
      >
        {summaryQuery.isLoading
          ? (
            <LoadingState
              title="Loading purchases"
              description="Fetching purchases from buyer service."
            />
          )
          : purchases.length
          ? <PurchasesTable data={purchases} />
          : (
            <EmptyState
              title="No purchases yet"
              description="Once intents convert, their purchases will be listed for audit."
            />
          )}
      </SectionCard>
    </div>
  );
}

"use client";

import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { PropertyRentalsPanel } from "@/components/property/PropertyRentalsPanel";
import { type MarketplaceAgentSessionsQueryParams } from "@/lib/queries/marketplaceAgentSessions";

interface PropertyRentalsClientProps {
  params: MarketplaceAgentSessionsQueryParams;
}

export function PropertyRentalsClient({ params }: PropertyRentalsClientProps) {
  const [queryParams] = useState(params);

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="Property rentals"
        description="Coordinate AI-assisted apartment hunting, shortlist comparisons, and monitor negotiation threads."
      />
      <PropertyRentalsPanel params={queryParams} />
    </div>
  );
}

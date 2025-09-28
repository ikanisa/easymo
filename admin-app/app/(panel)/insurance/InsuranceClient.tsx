"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { InsuranceTable } from "@/components/insurance/InsuranceTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  type InsuranceQueryParams,
  useInsuranceQuotesQuery,
} from "@/lib/queries/insurance";

interface InsuranceClientProps {
  initialParams?: InsuranceQueryParams;
}

export function InsuranceClient(
  { initialParams = { limit: 100 } }: InsuranceClientProps,
) {
  const [params] = useState<InsuranceQueryParams>(initialParams);
  const quotesQuery = useInsuranceQuotesQuery(params);

  const quotes = quotesQuery.data?.data ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Insurance"
        description="Human-in-the-loop review of insurance quotes, OCR extracts, and approval workflows."
      />
      <SectionCard
        title="Review queue"
        description="Approve or request changes with audit logging once API routes are available."
      >
        {quotesQuery.isLoading
          ? (
            <LoadingState
              title="Loading insurance queue"
              description="Gathering latest quotes."
            />
          )
          : quotes.length
          ? <InsuranceTable data={quotes} />
          : (
            <EmptyState
              title="No quotes pending"
              description="Insurance quotes will surface here when Supabase data is available."
            />
          )}
      </SectionCard>
    </div>
  );
}

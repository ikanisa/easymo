"use client";

import { useMemo, useState } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { InsuranceTable } from "@/components/insurance/InsuranceTable";
import { InsuranceWorkbench } from "@/components/insurance/InsuranceWorkbench";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import {
  type InsuranceQueryParams,
  useInsuranceQuotesQuery,
  useInsuranceQuotesRealtime,
  useApproveInsuranceQuoteMutation,
  useRequestChangesMutation,
  useUpdateInsuranceQuoteStatusMutation,
} from "@/lib/queries/insurance";
import type { InsuranceQuote } from "@/lib/schemas";

interface InsuranceClientProps {
  initialParams?: InsuranceQueryParams;
}

export function InsuranceClient(
  { initialParams = { limit: 100 } }: InsuranceClientProps,
) {
  const [params, setParams] = useState<InsuranceQueryParams>(initialParams);
  const queryParams = useMemo(() => ({ ...params }), [params]);
  const quotesQuery = useInsuranceQuotesQuery(queryParams);
  useInsuranceQuotesRealtime(queryParams);

  const approveMutation = useApproveInsuranceQuoteMutation(queryParams);
  const requestChangesMutation = useRequestChangesMutation(queryParams);
  const statusMutation = useUpdateInsuranceQuoteStatusMutation(queryParams);

  const quotes = quotesQuery.data?.data ?? [];
  const hasMore = quotesQuery.data?.hasMore;
  const loadingMore = quotesQuery.isFetching && !quotesQuery.isLoading;
  const statusValue = params.status ?? "";

  const approvingId = approveMutation.isPending ? approveMutation.variables ?? null : null;
  const requestingId = requestChangesMutation.isPending
    ? requestChangesMutation.variables?.quoteId ?? null
    : null;
  const updatingId = statusMutation.isPending
    ? statusMutation.variables?.quoteId ?? null
    : null;

  const handleStatusFilterChange = (value: string) => {
    setParams((prev) => ({
      ...prev,
      status: (value as InsuranceQueryParams["status"] | "") || undefined,
      limit: initialParams.limit ?? 100,
      offset: 0,
    }));
  };

  const handleLoadMore = () => {
    setParams((prev) => ({
      ...prev,
      limit: (prev.limit ?? initialParams.limit ?? 100) + 25,
    }));
  };

  const handleApprove = async (quoteId: string) => {
    await approveMutation.mutateAsync(quoteId);
  };

  const handleRequestChanges = async (quoteId: string, comment: string) => {
    await requestChangesMutation.mutateAsync({ quoteId, comment });
  };

  const handleStatusChange = async (
    quoteId: string,
    status: string,
    reviewerComment?: string | null,
  ) => {
    await statusMutation.mutateAsync({ quoteId, status, reviewerComment: reviewerComment ?? null });
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="Insurance"
        description="Human-in-the-loop review of insurance quotes, OCR extracts, and approval workflows."
      />
      <SectionCard
        title="Pricing workbench"
        description="Upload docs, run OCR, and compare BK, Old Mutual, Prime, and Radiant premiums before pushing to WhatsApp."
      >
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary
              onReset={() => {
                reset();
              }}
              fallback={
                <EmptyState
                  title="Workbench unavailable"
                  description="Retry to reload the insurance pricing workbench."
                />
              }
            >
              <InsuranceWorkbench />
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </SectionCard>
      <SectionCard
        title="Review queue"
        description="Approve or request changes with audit logging once API routes are available."
      >
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary
              onReset={() => {
                reset();
                quotesQuery.refetch().catch(() => {
                  // handled by boundary
                });
              }}
              fallback={
                <EmptyState
                  title="Failed to load insurance quotes"
                  description="Retry to refresh the review queue."
                />
              }
            >
              <ReviewSection
                quotesQuery={quotesQuery}
                quotes={quotes}
                hasMore={hasMore}
                loadingMore={loadingMore}
                statusValue={statusValue}
                onStatusFilterChange={handleStatusFilterChange}
                onLoadMore={handleLoadMore}
                onApprove={handleApprove}
                onRequestChanges={handleRequestChanges}
                onStatusUpdate={handleStatusChange}
                approvingId={approvingId}
                requestingId={requestingId}
                updatingId={updatingId}
              />
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </SectionCard>
    </div>
  );
}

interface ReviewSectionProps {
  quotesQuery: ReturnType<typeof useInsuranceQuotesQuery>;
  quotes: InsuranceQuote[];
  hasMore?: boolean;
  loadingMore: boolean;
  statusValue: string;
  onStatusFilterChange: (value: string) => void;
  onLoadMore: () => void;
  onApprove: (quoteId: string) => Promise<void>;
  onRequestChanges: (quoteId: string, comment: string) => Promise<void>;
  onStatusUpdate: (
    quoteId: string,
    status: string,
    reviewerComment?: string | null,
  ) => Promise<void>;
  approvingId: string | null;
  requestingId: string | null;
  updatingId: string | null;
}

function ReviewSection({
  quotesQuery,
  quotes,
  hasMore,
  loadingMore,
  statusValue,
  onStatusFilterChange,
  onLoadMore,
  onApprove,
  onRequestChanges,
  onStatusUpdate,
  approvingId,
  requestingId,
  updatingId,
}: ReviewSectionProps) {
  if (quotesQuery.isError) {
    throw quotesQuery.error;
  }

  if (quotesQuery.isLoading) {
    return (
      <LoadingState
        title="Loading insurance queue"
        description="Gathering latest quotes."
      />
    );
  }

  if (!quotes.length) {
    return (
      <EmptyState
        title="No quotes pending"
        description="Insurance quotes will surface here when Supabase data is available."
      />
    );
  }

  return (
    <InsuranceTable
      data={quotes}
      hasMore={hasMore}
      loadingMore={loadingMore}
      statusFilter={statusValue}
      onStatusChange={onStatusFilterChange}
      onLoadMore={onLoadMore}
      onApprove={onApprove}
      onRequestChanges={onRequestChanges}
      onUpdateStatus={onStatusUpdate}
      approvingId={approvingId}
      requestingId={requestingId}
      updatingId={updatingId}
    />
  );
}

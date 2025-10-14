"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { QrTokenTable } from "@/components/qr/QrTokenTable";
import { QrGeneratorForm } from "@/components/qr/QrGeneratorForm";
import { LoadingState } from "@/components/ui/LoadingState";
import { type QrTokensQueryParams, useQrTokensQuery } from "@/lib/queries/qr";
import { type BarsQueryParams, useBarsQuery } from "@/lib/queries/bars";
import { EmptyState } from "@/components/ui/EmptyState";
import { QrPreviewPanel } from "@/components/qr/QrPreviewPanel";

interface QrClientProps {
  initialTokenParams?: QrTokensQueryParams;
  initialBarParams?: BarsQueryParams;
}

export function QrClient({
  initialTokenParams = { limit: 100 },
  initialBarParams = { limit: 100 },
}: QrClientProps) {
  const [tokenParams, setTokenParams] = useState(initialTokenParams);
  const [barParams] = useState(initialBarParams);

  const tokensQuery = useQrTokensQuery(tokenParams);
  const barsQuery = useBarsQuery(barParams);

  const tokens = tokensQuery.data?.data ?? [];
  const bars = barsQuery.data?.data ?? [];
  const tokensHasMore = tokensQuery.data?.hasMore;
  const tokensLoadingMore = tokensQuery.isFetching && !tokensQuery.isLoading;
  const printedFilter = tokenParams.printed;

  return (
    <div className="admin-page">
      <PageHeader
        title="QR & Deep Links"
        description="Generate QR batches, manage table tokens, and preview the deep-link copy vendors rely on."
      />

      <SectionCard
        title="QR token generator"
        description="Batch creation, PDF pack downloads, and vendor-test sends will connect here."
      >
        {barsQuery.isLoading
          ? (
            <LoadingState
              title="Loading bars"
              description="Fetching bar directory."
            />
          )
          : bars.length
          ? <QrGeneratorForm bars={bars} />
          : (
            <EmptyState
              title="No bars available"
              description="Create a bar first to generate QR tokens."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Existing tokens"
        description="Review recently generated QR tokens and mark print status."
      >
        <div className="flex flex-wrap items-center gap-3 pb-4">
          <label className="text-sm text-[color:var(--color-muted)]">
            Printed
            <select
              value={printedFilter === undefined ? "" : printedFilter ? "true" : "false"}
              onChange={(event) =>
                setTokenParams((prev) => ({
                  ...prev,
                  printed: event.target.value === ""
                    ? undefined
                    : event.target.value === "true",
                  limit: initialTokenParams.limit ?? 100,
                  offset: 0,
                }))}
              className="ml-2 rounded-lg border border-[color:var(--color-border)]/40 bg-white/90 px-3 py-1 text-sm"
            >
              <option value="">All</option>
              <option value="true">Printed</option>
              <option value="false">Not printed</option>
            </select>
          </label>
        </div>
        {tokensQuery.isLoading
          ? (
            <LoadingState
              title="Loading tokens"
              description="Fetching QR token history."
            />
          )
          : tokens.length
          ? (
            <QrTokenTable
              data={tokens}
              hasMore={tokensHasMore}
              loadingMore={tokensLoadingMore}
              onLoadMore={() =>
                setTokenParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? initialTokenParams.limit ?? 100) + 50,
                }))}
            />
          )
          : (
            <EmptyState
              title="No tokens yet"
              description="Generate QR codes or load fixtures to see token history."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Deep-link preview"
        description="Preview the WhatsApp payload triggered by QR scans and optionally send yourself a test message."
      >
        {barsQuery.isLoading
          ? (
            <LoadingState
              title="Loading bars"
              description="Fetching bar directory."
            />
          )
          : bars.length
          ? <QrPreviewPanel bars={bars} />
          : (
            <EmptyState
              title="No bars available"
              description="Create a bar first to preview QR deep links."
            />
          )}
      </SectionCard>
    </div>
  );
}

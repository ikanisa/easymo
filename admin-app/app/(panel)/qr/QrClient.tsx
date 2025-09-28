"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { QrTokenTable } from "@/components/qr/QrTokenTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { QrGeneratorForm } from "@/components/qr/QrGeneratorForm";
import { LoadingState } from "@/components/ui/LoadingState";
import { type QrTokensQueryParams, useQrTokensQuery } from "@/lib/queries/qr";
import { type BarsQueryParams, useBarsQuery } from "@/lib/queries/bars";

interface QrClientProps {
  initialTokenParams?: QrTokensQueryParams;
  initialBarParams?: BarsQueryParams;
}

export function QrClient({
  initialTokenParams = { limit: 100 },
  initialBarParams = { limit: 100 },
}: QrClientProps) {
  const [tokenParams] = useState(initialTokenParams);
  const [barParams] = useState(initialBarParams);

  const tokensQuery = useQrTokensQuery(tokenParams);
  const barsQuery = useBarsQuery(barParams);

  const tokens = tokensQuery.data?.data ?? [];
  const bars = barsQuery.data?.data ?? [];

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
        {tokensQuery.isLoading
          ? (
            <LoadingState
              title="Loading tokens"
              description="Fetching QR token history."
            />
          )
          : tokens.length
          ? <QrTokenTable data={tokens} />
          : (
            <EmptyState
              title="No tokens yet"
              description="Generate QR codes or load fixtures to see token history."
            />
          )}
      </SectionCard>

      <SectionCard
        title="Deep-link preview"
        description="Preview the exact WhatsApp message and flow button that the QR triggers."
      >
        <EmptyState
          title="Preview placeholder"
          description="API bridge to fetch and send test messages will be added in Phase 3."
        />
      </SectionCard>
    </div>
  );
}

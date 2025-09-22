import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { QrTokenTable } from '@/components/qr/QrTokenTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { QrGeneratorForm } from '@/components/qr/QrGeneratorForm';
import { listQrTokens, listBars } from '@/lib/data-provider';

export default async function QrPage() {
  const [{ data: tokens }, { data: bars }] = await Promise.all([listQrTokens({ limit: 100 }), listBars({ limit: 100 })]);

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="QR & Deep Links"
        description="Generate QR batches, manage table tokens, and preview the deep-link copy vendors rely on."
      />

      <SectionCard
        title="QR token generator"
        description="Batch creation, PDF pack downloads, and vendor-test sends will connect here."
      >
        {bars.length ? (
          <QrGeneratorForm bars={bars} />
        ) : (
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
        {tokens.length ? (
          <QrTokenTable data={tokens} />
        ) : (
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

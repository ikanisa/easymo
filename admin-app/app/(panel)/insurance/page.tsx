import { PageHeader } from '@/components/layout/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { InsuranceTable } from '@/components/insurance/InsuranceTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { listInsuranceQuotes } from '@/lib/data-provider';

export default async function InsurancePage() {
  const { data } = await listInsuranceQuotes({ limit: 100 });

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Insurance"
        description="Human-in-the-loop review of insurance quotes, OCR extracts, and approval workflows."
      />

      <SectionCard
        title="Review queue"
        description="Approve or request changes with audit logging once API routes are available."
      >
        {data.length ? (
          <InsuranceTable data={data} />
        ) : (
          <EmptyState
            title="No quotes pending"
            description="Insurance quotes will surface here when Supabase data is available."
          />
        )}
      </SectionCard>
    </div>
  );
}

import { PageHeader } from '@/components/layout/PageHeader';
import { VouchersTable } from '@/components/vouchers/VouchersTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { VoucherPreviewButton } from '@/components/vouchers/VoucherPreviewButton';
import { VoucherGenerationForm } from '@/components/vouchers/VoucherGenerationForm';
import { listVouchers } from '@/lib/data-provider';
import { VoucherCsvUpload } from '@/components/vouchers/VoucherCsvUpload';

export default async function VouchersPage() {
  const { data } = await listVouchers({ limit: 200 });

  return (
    <div className="placeholder-grid">
      <PageHeader
        title="Vouchers"
        description="Monitor voucher lifecycle, preview ticket artwork, and prepare single or batch issuance. Preview and issuance flows will be wired in later phases."
      />
      <SectionCard
        title="Voucher ledger"
        description="Filter by status or search by ID/MSISDN. Row actions (preview, resend, void) will activate after API integration."
      >
        {data.length ? (
          <VouchersTable data={data} />
        ) : (
          <EmptyState
            title="No vouchers"
            description="Connect to Supabase or load fixtures to review voucher history."
          />
        )}
      </SectionCard>
      <SectionCard
        title="Generation & preview"
        description="Prototype components for voucher card preview and batch upload."
      >
        <div className="stack">
          {data.length ? <VoucherPreviewButton voucher={data[0]} /> : null}
          <VoucherGenerationForm />
          <VoucherCsvUpload instructions="Upload voucher issuance CSV (headers: msisdn, amount, expires_at). Preview currently returns row count only." />
        </div>
      </SectionCard>
    </div>
  );
}

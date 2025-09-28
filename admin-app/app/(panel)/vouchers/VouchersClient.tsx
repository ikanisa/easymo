'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { VouchersTable } from '@/components/vouchers/VouchersTable';
import { SectionCard } from '@/components/ui/SectionCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { VoucherPreviewButton } from '@/components/vouchers/VoucherPreviewButton';
import { VoucherGenerationForm } from '@/components/vouchers/VoucherGenerationForm';
import { VoucherCsvUpload } from '@/components/vouchers/VoucherCsvUpload';
import { LoadingState } from '@/components/ui/LoadingState';
import { useVouchersQuery, type VouchersQueryParams } from '@/lib/queries/vouchers';

interface VouchersClientProps {
  initialParams?: VouchersQueryParams;
}

export function VouchersClient({ initialParams = { limit: 200 } }: VouchersClientProps) {
  const [params] = useState<VouchersQueryParams>(initialParams);
  const vouchersQuery = useVouchersQuery(params);

  const vouchers = vouchersQuery.data?.data ?? [];

  return (
    <div className="admin-page">
      <PageHeader
        title="Vouchers"
        description="Monitor voucher lifecycle, preview ticket artwork, and prepare single or batch issuance. Preview and issuance flows will be wired in later phases."
      />
      <SectionCard
        title="Voucher ledger"
        description="Filter by status or search by ID/MSISDN. Row actions (preview, resend, void) will activate after API integration."
      >
        {vouchersQuery.isLoading ? (
          <LoadingState title="Loading vouchers" description="Fetching voucher ledger." />
        ) : vouchers.length ? (
          <VouchersTable data={vouchers} />
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
        <div className="stack space-y-6">
          {vouchers.length ? <VoucherPreviewButton voucher={vouchers[0]} /> : null}
          <VoucherGenerationForm />
          <VoucherCsvUpload instructions="Upload voucher issuance CSV (headers: msisdn, amount, expires_at). Preview currently returns row count only." />
        </div>
      </SectionCard>
    </div>
  );
}

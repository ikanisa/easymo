"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { VouchersTable } from "@/components/vouchers/VouchersTable";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { VoucherPreviewButton } from "@/components/vouchers/VoucherPreviewButton";
import { VoucherGenerationForm } from "@/components/vouchers/VoucherGenerationForm";
import { VoucherCsvUpload } from "@/components/vouchers/VoucherCsvUpload";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  useVouchersQuery,
  type VouchersQueryParams,
} from "@/lib/queries/vouchers";
import { IntegrationStatusChip } from "@/components/ui/IntegrationStatusChip";
import { useIntegrationStatusQuery } from "@/lib/queries/integrations";
import { PolicyDetails } from "@/components/policy/PolicyDetails";
import { useAdminVoucherRecentQuery } from "@/lib/queries/adminVouchers";
import { AdminVoucherList } from "@/components/vouchers/AdminVoucherList";
import { AdminVoucherDetailDrawer } from "@/components/vouchers/AdminVoucherDetailDrawer";

interface VouchersClientProps {
  initialParams?: VouchersQueryParams;
}

export function VouchersClient(
  { initialParams = { limit: 200 } }: VouchersClientProps,
) {
  const [params, setParams] = useState<VouchersQueryParams>(initialParams);
  const [adminVoucherId, setAdminVoucherId] = useState<string | null>(null);
  const vouchersQuery = useVouchersQuery(params);
  const integrationStatus = useIntegrationStatusQuery();
  const adminVoucherRecentQuery = useAdminVoucherRecentQuery();

  const vouchers = vouchersQuery.data?.data ?? [];
  const hasMore = vouchersQuery.data?.hasMore;
  const loadingMore = vouchersQuery.isFetching && !vouchersQuery.isLoading;
  const statusFilter = params.status ?? "";
  const searchFilter = params.search ?? "";

  return (
    <div className="admin-page">
      <PageHeader
        title="Vouchers"
        description="Monitor voucher lifecycle, preview ticket artwork, and prepare single or batch issuance. Preview and issuance flows will be wired in later phases."
        meta={
          <div className="flex flex-wrap gap-2">
            <IntegrationStatusChip
              label="Preview"
              status={integrationStatus.data?.voucherPreview}
              isLoading={integrationStatus.isLoading}
            />
            <IntegrationStatusChip
              label="Send"
              status={integrationStatus.data?.whatsappSend}
              isLoading={integrationStatus.isLoading}
            />
          </div>
        }
      />
      <PolicyDetails />
      <SectionCard
        title="Recent WhatsApp voucher actions"
        description="Live feed from the WhatsApp admin flow. Configure ADMIN_FLOW_WA_ID to hydrate with production data."
      >
        {adminVoucherRecentQuery.data
          ? (
            <AdminVoucherList
              vouchers={adminVoucherRecentQuery.data.vouchers}
              messages={adminVoucherRecentQuery.data.messages}
              onSelect={setAdminVoucherId}
            />
          )
          : adminVoucherRecentQuery.isLoading
          ? (
            <LoadingState
              title="Loading recent vouchers"
              description="Calling flow-exchange admin bridge."
            />
          )
          : (
            <EmptyState
              title="Voucher feed unavailable"
              description="Unable to load flow-exchange voucher data."
            />
          )}
      </SectionCard>
      <SectionCard
        title="Voucher ledger"
        description="Filter by status or search by ID/MSISDN. Row actions (preview, resend, void) will activate after API integration."
      >
        {vouchersQuery.isLoading
          ? (
            <LoadingState
              title="Loading vouchers"
              description="Fetching voucher ledger."
            />
          )
          : vouchers.length
          ? (
            <VouchersTable
              data={vouchers}
              statusFilter={statusFilter}
              searchFilter={searchFilter}
              hasMore={hasMore}
              loadingMore={loadingMore}
              onStatusChange={(value) =>
                setParams((prev) => ({
                  ...prev,
                  status: (value as VouchersQueryParams['status'] | '') || undefined,
                  limit: initialParams.limit ?? 200,
                  offset: 0,
                }))}
              onSearchChange={(value) =>
                setParams((prev) => ({
                  ...prev,
                  search: value || undefined,
                  limit: initialParams.limit ?? 200,
                  offset: 0,
                }))}
              onLoadMore={() =>
                setParams((prev) => ({
                  ...prev,
                  limit: (prev.limit ?? initialParams.limit ?? 200) + 50,
                }))}
            />
          )
          : (
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
          {vouchers.length
            ? <VoucherPreviewButton voucher={vouchers[0]} />
            : null}
          <VoucherGenerationForm />
          <VoucherCsvUpload instructions="Upload voucher issuance CSV (headers: msisdn, amount, expires_at). Preview currently returns row count only." />
        </div>
      </SectionCard>
      <AdminVoucherDetailDrawer
        voucherId={adminVoucherId}
        onClose={() => setAdminVoucherId(null)}
      />
    </div>
  );
}

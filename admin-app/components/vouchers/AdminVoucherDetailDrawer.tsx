"use client";

import { useMemo } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { LoadingState } from "@/components/ui/LoadingState";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAdminVoucherDetailQuery } from "@/lib/queries/adminVoucherDetail";

interface AdminVoucherDetailDrawerProps {
  voucherId: string | null;
  onClose: () => void;
}

export function AdminVoucherDetailDrawer(
  { voucherId, onClose }: AdminVoucherDetailDrawerProps,
) {
  const query = useAdminVoucherDetailQuery(voucherId);
  const voucher = query.data;

  const rows = useMemo(() => {
    if (!voucher) return [] as Array<{ label: string; value: string }>;
    return [
      { label: "Code", value: voucher.code5 },
      { label: "Amount", value: voucher.amountText },
      { label: "Policy", value: voucher.policyNumber ?? "—" },
      { label: "WhatsApp", value: voucher.whatsappE164 ?? "—" },
      { label: "Status", value: voucher.status },
      { label: "Issued", value: voucher.issuedAt },
      { label: "Redeemed", value: voucher.redeemedAt ?? "—" },
    ];
  }, [voucher]);

  const messages = voucher?.messages ?? [];

  return (
    <Drawer
      title={voucher ? `Voucher ${voucher.code5}` : "Voucher details"}
      onClose={onClose}
    >
      {!voucherId
        ? (
          <EmptyState
            title="No voucher selected"
            description="Choose a voucher from the WhatsApp feed to inspect details."
          />
        )
        : query.isLoading
        ? (
          <LoadingState
            title="Loading voucher detail"
            description="Fetching detail from flow-exchange."
          />
        )
        : voucher
        ? (
          <div className="space-y-4">
            {messages.length > 0 && (
              <div className="rounded-md border border-dashed border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                {messages.map((message, index) => (
                  <p key={index}>{message}</p>
                ))}
              </div>
            )}
            <dl className="grid gap-3">
              {rows.map((row) => (
                <div key={row.label}>
                  <dt className="text-xs uppercase text-muted-foreground">
                    {row.label}
                  </dt>
                  <dd className="text-sm text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted-foreground">
              Redeem, resend, and void actions will appear here once write APIs are available.
            </p>
          </div>
        )
        : (
          <EmptyState
            title="Voucher detail unavailable"
            description="We could not load voucher detail from flow-exchange."
          />
        )}
    </Drawer>
  );
}

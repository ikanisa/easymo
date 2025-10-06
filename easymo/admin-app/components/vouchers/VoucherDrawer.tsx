"use client";

import { Drawer } from "@/components/ui/Drawer";
import { useMemo } from "react";
import type { Voucher } from "@/lib/schemas";
import styles from "./VoucherDrawer.module.css";

interface VoucherDrawerProps {
  voucher: Voucher | null;
  onClose: () => void;
}

export function VoucherDrawer({ voucher, onClose }: VoucherDrawerProps) {
  const title = voucher ? `Voucher ${voucher.id}` : "Voucher details";

  const rows = useMemo(() => {
    if (!voucher) return [] as Array<{ label: string; value: string }>;
    return [
      { label: "Status", value: voucher.status },
      {
        label: "Amount",
        value: `${voucher.amount.toLocaleString()} ${voucher.currency}`,
      },
      {
        label: "User",
        value: voucher.userName ?? voucher.msisdn,
      },
      {
        label: "Station scope",
        value: voucher.stationScope ?? "—",
      },
      {
        label: "Campaign",
        value: voucher.campaignId ?? "—",
      },
      {
        label: "Issued",
        value: new Date(voucher.issuedAt).toLocaleString(),
      },
      {
        label: "Redeemed",
        value: voucher.redeemedAt
          ? new Date(voucher.redeemedAt).toLocaleString()
          : "—",
      },
      {
        label: "Expires",
        value: voucher.expiresAt
          ? new Date(voucher.expiresAt).toLocaleString()
          : "—",
      },
    ];
  }, [voucher]);

  return (
    <Drawer title={title} onClose={onClose}>
      {!voucher
        ? <p className={styles.placeholder}>Select a voucher to view details.</p>
        : (
          <div className={styles.content}>
            <section>
              <h3>Summary</h3>
              <dl className={styles.definitionList}>
                {rows.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h3>Next steps</h3>
              <p>
                Resend, void, and redemption timelines will appear here once write
                APIs are enabled. For now this drawer provides read-only insight
                for support investigations.
              </p>
            </section>
          </div>
        )}
    </Drawer>
  );
}

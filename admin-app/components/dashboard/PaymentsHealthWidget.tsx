"use client";

import { PaymentStatusWidget } from "@easymo/ui/widgets/PaymentStatusWidget";
import { SectionCard } from "@/components/ui/SectionCard";

export function PaymentsHealthWidget() {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("en-RW", { style: "currency", currency: "RWF", maximumFractionDigits: 0 }).format(
      Math.round(value),
    );
  const formatPercent = (value: number) => `${Math.round(value)}%`;
  return (
    <SectionCard
      title="Payments health"
      description="Reconciles MoMo, Revolut, and in-flight disputes across wallets."
    >
      <PaymentStatusWidget
        totalVolume={formatCurrency(0)}
        growthLabel="—"
        momoShare={formatPercent(0)}
        cardShare={formatPercent(0)}
        pendingCount={0}
        disputesCount={0}
        cta={
          <a
            href="/wallet"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            View ledger →
          </a>
        }
      />
    </SectionCard>
  );
}

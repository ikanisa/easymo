"use client";

import { PaymentStatusWidget } from "@easymo/ui/widgets/PaymentStatusWidget";
import { SectionCard } from "@/components/ui/SectionCard";

export function PaymentsHealthWidget() {
  return (
    <SectionCard
      title="Payments health"
      description="Reconciles MoMo, Revolut, and in-flight disputes across wallets."
    >
      <PaymentStatusWidget
        totalVolume={0}
        growthLabel="—"
        momoShare={0}
        cardShare={0}
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

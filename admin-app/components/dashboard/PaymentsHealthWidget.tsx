"use client";

import Link from "next/link";
import { PaymentStatusWidget } from "@easymo/ui/widgets/PaymentStatusWidget";
import { mockPaymentsHealth } from "@/lib/mock-data";
import { SectionCard } from "@/components/ui/SectionCard";

export function PaymentsHealthWidget() {
  return (
    <SectionCard
      title="Payments health"
      description="Reconciles MoMo, Revolut, and in-flight disputes across wallets."
    >
      <PaymentStatusWidget
        totalVolume={mockPaymentsHealth.totalVolume}
        growthLabel={mockPaymentsHealth.growthLabel}
        momoShare={mockPaymentsHealth.momoShare}
        cardShare={mockPaymentsHealth.cardShare}
        pendingCount={mockPaymentsHealth.pendingCount}
        disputesCount={mockPaymentsHealth.disputesCount}
        cta={
          <Link
            href="/wallet"
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            View ledger →
          </Link>
        }
      />
    </SectionCard>
  );
}

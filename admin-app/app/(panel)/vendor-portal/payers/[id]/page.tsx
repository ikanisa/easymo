'use client';

/**
 * Payer Detail Page
 * Shows individual payer stats and transaction history
 */

import { useRouter } from 'next/navigation';
import { use } from 'react';

import { PortalShell } from '@/components/vendor-portal/layout';
import { TransactionCard } from '@/components/vendor-portal/transactions';
import { EmptyState, MoneyDisplay } from '@/components/vendor-portal/ui';
import { 
  formatRelativeTime, 
  mockPayers, 
  mockTransactions 
} from '@/lib/vendor-portal/mock-data';

interface PayerDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function PayerDetailPage({ params }: PayerDetailPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  
  // Find payer by ID
  const payer = mockPayers.find((p) => p.id === resolvedParams.id);
  
  // Get payer's transactions
  const payerTransactions = mockTransactions.filter(
    (txn) => payer && txn.payerName === payer.name
  );

  if (!payer) {
    return (
      <PortalShell 
        title="Payer Not Found" 
        showBackButton 
        onBack={() => router.back()}
      >
        <EmptyState
          title="Payer not found"
          description="The payer you're looking for doesn't exist."
        />
      </PortalShell>
    );
  }

  return (
    <PortalShell
      title={payer.name}
      showBackButton
      onBack={() => router.back()}
    >
      <div className="space-y-6">
        {/* Payer Info Card */}
        <div className="vp-card vp-payer-detail">
          <div className="vp-payer-detail__header">
            <div className="vp-payer-detail__avatar">
              {payer.initials}
            </div>
            <div>
              <h2 className="vp-payer-detail__name">{payer.name}</h2>
              <p className="vp-payer-detail__phone">{payer.phone}</p>
            </div>
          </div>
          
          <div className="vp-payer-detail__stats">
            <div>
              <p className="vp-payer-detail__label">Total Paid</p>
              <p className="vp-payer-detail__value vp-payer-detail__value--primary">
                <MoneyDisplay amount={payer.totalPaid} currency={payer.currency} />
              </p>
            </div>
            <div>
              <p className="vp-payer-detail__label">Payments</p>
              <p className="vp-payer-detail__value">
                {payer.transactionCount}
              </p>
            </div>
            <div className="vp-payer-detail__full-width">
              <p className="vp-payer-detail__label">Last Payment</p>
              <p className="vp-payer-detail__value">
                {formatRelativeTime(payer.lastPaymentDate)}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <section>
          <h3 className="vp-section-title mb-3">Payment History</h3>
          {payerTransactions.length === 0 ? (
            <div className="vp-card">
              <EmptyState 
                type="transactions"
                title="No transactions"
                description="No payment history for this payer."
              />
            </div>
          ) : (
            <div className="vp-card">
              {payerTransactions.map((txn) => (
                <TransactionCard key={txn.id} transaction={txn} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PortalShell>
  );
}

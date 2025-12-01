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
        <div className="vp-card p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-xl bg-emerald-500 text-white flex items-center justify-center text-xl font-bold">
              {payer.initials}
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{payer.name}</h2>
              <p className="text-gray-500">{payer.phone}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
            <div>
              <p className="text-sm text-gray-500">Total Paid</p>
              <p className="text-xl font-bold text-emerald-600">
                <MoneyDisplay amount={payer.totalPaid} currency={payer.currency} />
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Payments</p>
              <p className="text-xl font-bold text-gray-900">
                {payer.transactionCount}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-500">Last Payment</p>
              <p className="text-base font-medium text-gray-900">
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

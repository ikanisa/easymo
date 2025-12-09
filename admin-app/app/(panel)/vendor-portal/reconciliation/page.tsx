'use client';

/**
 * Reconciliation Page
 * Dashboard for matching payments to members
 */

import { useState } from 'react';
import { PortalShell } from '@/components/vendor-portal/layout';
import { MatchingModal } from '@/components/vendor-portal/reconciliation/MatchingModal';
import { BulkActions } from '@/components/vendor-portal/reconciliation/BulkActions';
import { DataTable } from '@/components/vendor-portal/ui/DataTable';
import { Badge } from '@/components/vendor-portal/ui/Badge';
import { Button } from '@/components/vendor-portal/ui/Button';
import { formatCurrency, formatDate, formatPhone } from '@/lib/vendor-portal/utils/format';
import { exportToCSV } from '@/lib/vendor-portal/utils/export';
import type { Payment, Member, Column } from '@/lib/vendor-portal/types';

// Mock data
const mockPayments: Payment[] = [
  {
    id: 'pay-001',
    sacco_id: 'sacco-001',
    amount: 10000,
    currency: 'RWF',
    phone: '+250788123456',
    reference: 'TXN001234',
    status: 'pending',
    metadata: {},
    created_at: new Date('2024-12-09T10:30:00'),
    updated_at: new Date('2024-12-09T10:30:00'),
  },
  {
    id: 'pay-002',
    sacco_id: 'sacco-001',
    member_id: 'mem-001',
    amount: 15000,
    currency: 'RWF',
    phone: '+250788456789',
    reference: 'TXN001235',
    status: 'completed',
    matched_at: new Date('2024-12-09T11:00:00'),
    metadata: {},
    created_at: new Date('2024-12-09T09:15:00'),
    updated_at: new Date('2024-12-09T11:00:00'),
  },
];

const mockMembers: Member[] = [
  {
    id: 'mem-001',
    sacco_id: 'sacco-001',
    full_name: 'Jean Baptiste',
    phone: '+250788123456',
    account_number: 'ACC-001',
    account_type: 'savings',
    balance: 150000,
    status: 'active',
    metadata: {},
    created_at: new Date('2024-01-15'),
    updated_at: new Date('2024-01-15'),
  },
];

export default function ReconciliationPage() {
  const [payments] = useState<Payment[]>(mockPayments);
  const [members] = useState<Member[]>(mockMembers);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedPayments, setSelectedPayments] = useState<Payment[]>([]);
  const [isMatchModalOpen, setIsMatchModalOpen] = useState(false);

  const unmatchedCount = payments.filter((p) => !p.member_id).length;
  const matchedCount = payments.filter((p) => p.member_id).length;
  const pendingCount = payments.filter((p) => p.status === 'pending').length;

  const columns: Column<Payment>[] = [
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      render: (payment) => formatDate(payment.created_at, 'datetime'),
    },
    {
      key: 'amount',
      header: 'Amount',
      sortable: true,
      render: (payment) => formatCurrency(payment.amount, payment.currency),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (payment) => payment.phone ? formatPhone(payment.phone) : 'N/A',
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (payment) => payment.reference || 'N/A',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (payment) => (
        <Badge variant={payment.status === 'completed' ? 'success' : 'warning'}>
          {payment.status}
        </Badge>
      ),
    },
    {
      key: 'matched',
      header: 'Matched',
      render: (payment) =>
        payment.member_id ? (
          <Badge variant="success">Matched</Badge>
        ) : (
          <Badge variant="warning">Unmatched</Badge>
        ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (payment) =>
        !payment.member_id ? (
          <Button
            size="sm"
            variant="primary"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPayment(payment);
              setIsMatchModalOpen(true);
            }}
          >
            Match
          </Button>
        ) : null,
    },
  ];

  const handleMatch = async (paymentId: string, memberId: string) => {
    console.log('Matching payment', paymentId, 'to member', memberId);
    // TODO: Call API to match payment
  };

  const handleAutoMatch = async () => {
    console.log('Auto-matching selected payments:', selectedPayments);
    // TODO: Implement auto-match logic
  };

  const handleMarkReviewed = async () => {
    console.log('Marking as reviewed:', selectedPayments);
    // TODO: Implement mark as reviewed
  };

  const handleExport = () => {
    exportToCSV(
      selectedPayments.length > 0 ? selectedPayments : payments,
      'reconciliation-export',
      [
        { key: 'created_at', label: 'Date' },
        { key: 'amount', label: 'Amount' },
        { key: 'currency', label: 'Currency' },
        { key: 'phone', label: 'Phone' },
        { key: 'reference', label: 'Reference' },
        { key: 'status', label: 'Status' },
      ]
    );
  };

  return (
    <PortalShell title="Reconciliation">
      <div className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Matched</p>
            <p className="text-2xl font-bold text-green-600">{matchedCount}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Unmatched</p>
            <p className="text-2xl font-bold text-yellow-600">{unmatchedCount}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-600">Pending</p>
            <p className="text-2xl font-bold text-gray-900">{pendingCount}</p>
          </div>
        </div>

        {/* Bulk Actions */}
        <BulkActions
          selectedCount={selectedPayments.length}
          onAutoMatch={handleAutoMatch}
          onMarkReviewed={handleMarkReviewed}
          onExport={handleExport}
        />

        {/* Payments Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <DataTable
            data={payments}
            columns={columns}
            keyExtractor={(payment) => payment.id}
            selectable
            onSelectionChange={setSelectedPayments}
            emptyMessage="No payments to reconcile"
          />
        </div>

        {/* Matching Modal */}
        <MatchingModal
          isOpen={isMatchModalOpen}
          onClose={() => {
            setIsMatchModalOpen(false);
            setSelectedPayment(null);
          }}
          payment={selectedPayment}
          members={members}
          onMatch={handleMatch}
        />
      </div>
    </PortalShell>
  );
}

'use client';

/**
 * Member Detail Page
 * Shows detailed information about a specific member
 */

import { use } from 'react';
import { PortalShell } from '@/components/vendor-portal/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/vendor-portal/ui/Card';
import { Badge } from '@/components/vendor-portal/ui/Badge';
import { Button } from '@/components/vendor-portal/ui/Button';
import { formatCurrency, formatDate, formatPhone, getInitials } from '@/lib/vendor-portal/utils/format';
import type { Member, Payment } from '@/lib/vendor-portal/types';

// Mock member data
const mockMember: Member = {
  id: 'mem-001',
  sacco_id: 'sacco-001',
  full_name: 'Jean Baptiste',
  phone: '+250788123456',
  national_id: '1234567890123456',
  account_number: 'ACC-001',
  account_type: 'savings',
  balance: 150000,
  status: 'active',
  metadata: {},
  created_at: new Date('2024-01-15'),
  updated_at: new Date('2024-01-15'),
};

const mockPayments: Payment[] = [
  {
    id: 'pay-001',
    sacco_id: 'sacco-001',
    member_id: 'mem-001',
    amount: 10000,
    currency: 'RWF',
    payment_method: 'mobile_money',
    reference: 'TXN001234',
    phone: '+250788123456',
    status: 'completed',
    metadata: {},
    created_at: new Date('2024-12-01'),
    updated_at: new Date('2024-12-01'),
  },
];

export default function MemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const member = mockMember; // TODO: Fetch from API
  const payments = mockPayments; // TODO: Fetch from API

  const statusColors = {
    active: 'success',
    inactive: 'warning',
    suspended: 'danger',
  } as const;

  return (
    <PortalShell title={member.full_name}>
      <div className="space-y-6">
        {/* Member Profile Card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                {getInitials(member.full_name)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">{member.full_name}</h2>
                    <p className="text-gray-600">{formatPhone(member.phone)}</p>
                  </div>
                  <Badge variant={statusColors[member.status]}>
                    {member.status}
                  </Badge>
                </div>
                
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Account Number</p>
                    <p className="font-semibold">{member.account_number || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Account Type</p>
                    <p className="font-semibold capitalize">{member.account_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">National ID</p>
                    <p className="font-semibold">{member.national_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Member Since</p>
                    <p className="font-semibold">{formatDate(member.created_at)}</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Card */}
        <Card>
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-900">
              {formatCurrency(member.balance)}
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {payments.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No payments yet</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{formatCurrency(payment.amount)}</p>
                      <p className="text-sm text-gray-600">{formatDate(payment.created_at, 'datetime')}</p>
                      {payment.reference && (
                        <p className="text-xs text-gray-500">Ref: {payment.reference}</p>
                      )}
                    </div>
                    <Badge variant={payment.status === 'completed' ? 'success' : 'warning'}>
                      {payment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="primary">Edit Member</Button>
          <Button variant="outline">View Groups</Button>
          <Button variant="danger">Suspend Member</Button>
        </div>
      </div>
    </PortalShell>
  );
}

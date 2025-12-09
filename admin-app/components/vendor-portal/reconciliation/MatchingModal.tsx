'use client';

/**
 * Matching Modal Component
 * Modal for manually matching SMS payments to members
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { formatCurrency, formatDate, formatPhone } from '@/lib/vendor-portal/utils/format';
import type { Payment, Member } from '@/lib/vendor-portal/types';

export interface MatchingModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
  members: Member[];
  onMatch: (paymentId: string, memberId: string) => void | Promise<void>;
}

export function MatchingModal({ isOpen, onClose, payment, members, onMatch }: MatchingModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!payment) return null;

  const filteredMembers = members.filter(
    (member) =>
      member.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.phone.includes(searchQuery) ||
      member.account_number?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Auto-suggest members by phone match
  const suggestedMembers = payment.phone
    ? members.filter((m) => m.phone.replace(/\D/g, '').includes(payment.phone!.replace(/\D/g, '')))
    : [];

  const handleMatch = async () => {
    if (!selectedMember) return;

    setIsLoading(true);
    try {
      await onMatch(payment.id, selectedMember.id);
      onClose();
    } catch (error) {
      console.error('Failed to match payment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Match Payment to Member"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleMatch}
            disabled={!selectedMember}
            loading={isLoading}
          >
            Confirm Match
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Payment Details */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-2">Payment Details</h4>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-semibold">{formatCurrency(payment.amount, payment.currency)}</span>
            </div>
            {payment.phone && (
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-semibold">{formatPhone(payment.phone)}</span>
              </div>
            )}
            {payment.reference && (
              <div className="flex justify-between">
                <span className="text-gray-600">Reference:</span>
                <span className="font-semibold">{payment.reference}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Date:</span>
              <span className="font-semibold">{formatDate(payment.created_at, 'datetime')}</span>
            </div>
          </div>
        </div>

        {/* Suggested Matches */}
        {suggestedMembers.length > 0 && (
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Suggested Matches</h4>
            <div className="space-y-2">
              {suggestedMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className={`w-full text-left p-3 border rounded-lg transition-colors ${
                    selectedMember?.id === member.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">{member.full_name}</div>
                  <div className="text-sm text-gray-600">{formatPhone(member.phone)}</div>
                  {member.account_number && (
                    <div className="text-xs text-gray-500">Account: {member.account_number}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search Members */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-2">Search Members</h4>
          <Input
            placeholder="Search by name, phone, or account..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="mt-2 max-h-60 overflow-y-auto space-y-2">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No members found</p>
            ) : (
              filteredMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className={`w-full text-left p-3 border rounded-lg transition-colors ${
                    selectedMember?.id === member.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">{member.full_name}</div>
                  <div className="text-sm text-gray-600">{formatPhone(member.phone)}</div>
                  {member.account_number && (
                    <div className="text-xs text-gray-500">Account: {member.account_number}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

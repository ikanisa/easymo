'use client';

/**
 * SACCO Payments Dashboard Page
 * Shows matched payments and unmatched SMS with manual matching workflow
 */

import { useState } from 'react';
import { PortalShell } from '@/components/vendor-portal/layout';

// Tabs
type TabType = 'matched' | 'unmatched';

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('matched');
  
  // Mock SACCO ID - in production, this would come from auth context
  const saccoId = '00000000-0000-0000-0000-000000000000';

  return (
    <PortalShell title="Payments">
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('matched')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'matched'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Matched Payments
          </button>
          <button
            onClick={() => setActiveTab('unmatched')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'unmatched'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Unmatched SMS
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'matched' && <MatchedPaymentsTab saccoId={saccoId} />}
        {activeTab === 'unmatched' && <UnmatchedSmsTab saccoId={saccoId} />}
      </div>
    </PortalShell>
  );
}

// Matched Payments Tab Component
function MatchedPaymentsTab({ saccoId }: { saccoId: string }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // TODO: Fetch payments from API
  // useEffect(() => {
  //   fetch(`/api/payments?saccoId=${saccoId}`)
  //     .then(res => res.json())
  //     .then(data => {
  //       setPayments(data.data);
  //       setIsLoading(false);
  //     });
  // }, [saccoId]);

  return (
    <div className="vp-card">
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-4">Matched Payments</h2>
        
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="h-16 bg-gray-200 rounded"></div>
              </div>
            ))}
          </div>
        ) : payments.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No matched payments yet</p>
            <p className="text-sm mt-2">Payments will appear here once SMS messages are matched to members</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {payments.map((payment) => (
              <div key={payment.id} className="py-3 flex items-center justify-between">
                <div className="flex-1">
                  <div className="font-medium">
                    {payment.memberFirstName} {payment.memberLastName}
                  </div>
                  <div className="text-sm text-gray-600">
                    Member #{payment.memberNumber}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(payment.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600">
                    {payment.currency} {payment.amount.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500">
                    {payment.provider || 'MoMo'}
                  </div>
                  {payment.status === 'completed' && (
                    <div className="text-xs text-green-600 mt-1">✓ Completed</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Unmatched SMS Tab Component
function UnmatchedSmsTab({ saccoId }: { saccoId: string }) {
  const [unmatched, setUnmatched] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSms, setSelectedSms] = useState<any | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [isMatching, setIsMatching] = useState(false);

  // TODO: Fetch unmatched SMS from API
  // useEffect(() => {
  //   fetch(`/api/payments/unmatched?saccoId=${saccoId}`)
  //     .then(res => res.json())
  //     .then(data => {
  //       setUnmatched(data.data);
  //       setIsLoading(false);
  //     });
  // }, [saccoId]);

  const handleMatch = async () => {
    if (!selectedSms || !selectedMemberId) return;
    
    setIsMatching(true);
    try {
      const response = await fetch('/api/payments/unmatched', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smsInboxId: selectedSms.id,
          memberId: selectedMemberId,
          saccoId,
        }),
      });
      
      if (response.ok) {
        // Remove matched SMS from list
        setUnmatched(unmatched.filter(sms => sms.id !== selectedSms.id));
        setSelectedSms(null);
        setSelectedMemberId('');
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      alert('Failed to match SMS');
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Unmatched SMS List */}
      <div className="vp-card">
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Unmatched SMS</h2>
          
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          ) : unmatched.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>All SMS messages are matched!</p>
              <p className="text-sm mt-2">No unmatched SMS messages</p>
            </div>
          ) : (
            <div className="space-y-3">
              {unmatched.map((sms) => (
                <button
                  key={sms.id}
                  onClick={() => setSelectedSms(sms)}
                  className={`w-full text-left p-3 rounded border transition-colors ${
                    selectedSms?.id === sms.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium">
                    {sms.senderName || sms.senderPhone}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Amount: {sms.amount?.toLocaleString()} RWF
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(sms.receivedAt).toLocaleString()}
                  </div>
                  {sms.transactionId && (
                    <div className="text-xs text-gray-500 mt-1">
                      Txn: {sms.transactionId}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual Match Panel */}
      <div className="vp-card">
        <div className="p-4">
          <h2 className="text-lg font-semibold mb-4">Manual Match</h2>
          
          {!selectedSms ? (
            <div className="text-center py-12 text-gray-500">
              <p>Select an SMS to match</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* SMS Details */}
              <div className="bg-gray-50 p-4 rounded">
                <h3 className="font-medium mb-2">SMS Details</h3>
                <div className="text-sm space-y-1">
                  <p><span className="text-gray-600">From:</span> {selectedSms.senderName || selectedSms.senderPhone}</p>
                  <p><span className="text-gray-600">Phone:</span> {selectedSms.senderPhone}</p>
                  <p><span className="text-gray-600">Amount:</span> {selectedSms.amount?.toLocaleString()} {selectedSms.currency || 'RWF'}</p>
                  {selectedSms.transactionId && (
                    <p><span className="text-gray-600">Transaction ID:</span> {selectedSms.transactionId}</p>
                  )}
                  <p><span className="text-gray-600">Received:</span> {new Date(selectedSms.receivedAt).toLocaleString()}</p>
                </div>
                <div className="mt-3 p-2 bg-white rounded text-xs">
                  <div className="text-gray-600 mb-1">Raw Message:</div>
                  <div>{selectedSms.rawMessage}</div>
                </div>
              </div>

              {/* Member Selection */}
              <div>
                <label htmlFor="member-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Member
                </label>
                <select
                  id="member-select"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">-- Select a member --</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.firstName} {member.lastName} (#{member.memberNumber})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  TODO: Load members from API
                </p>
              </div>

              {/* Match Button */}
              <button
                onClick={handleMatch}
                disabled={!selectedMemberId || isMatching}
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isMatching ? 'Matching...' : 'Match & Process Payment'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

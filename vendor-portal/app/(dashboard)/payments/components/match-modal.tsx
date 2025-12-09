// ═══════════════════════════════════════════════════════════════════════════
// Manual Match Modal Component
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { useState, useEffect } from "react";
import { useMemberSearch } from "@/lib/hooks/use-members";
import { useManualMatch } from "@/lib/hooks/use-payments";
import { formatCurrency, cn } from "@/lib/utils";
import type { UnmatchedSMS, Member } from "@/types/payment";

interface MatchModalProps {
  sms: UnmatchedSMS | null;
  saccoId: string;
  onClose: () => void;
}

export function MatchModal({ sms, saccoId, onClose }: MatchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [showResults, setShowResults] = useState(false);

  const { data: searchResults, isLoading: isSearching } = useMemberSearch(
    saccoId,
    searchQuery,
    searchQuery.length >= 2
  );

  const { mutate: matchPayment, isPending: isMatching } = useManualMatch();

  useEffect(() => {
    setShowResults(searchQuery.length >= 2 && !selectedMember);
  }, [searchQuery, selectedMember]);

  if (!sms) return null;

  const handleSelectMember = (member: Member) => {
    setSelectedMember(member);
    setSearchQuery(member.full_name);
    setShowResults(false);
  };

  const handleMatch = () => {
    if (!selectedMember) return;

    matchPayment(
      {
        sms_id: sms.id,
        member_id: selectedMember.id,
        sacco_id: saccoId,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (error) => {
          alert(`Failed to match: ${error.message}`);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold">Match Payment to Member</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* SMS Details */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">SMS Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Sender:</span>
                <span className="font-medium">{sms.sender}</span>
              </div>
              {sms.parsed_data?.amount && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Amount:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(sms.parsed_data.amount)}
                  </span>
                </div>
              )}
              {sms.parsed_data?.transaction_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Reference:</span>
                  <span className="font-medium">{sms.parsed_data.transaction_id}</span>
                </div>
              )}
              <div className="pt-2 border-t">
                <span className="text-gray-600 text-xs">{sms.message}</span>
              </div>
            </div>
          </div>

          {/* Member Search */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Member
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedMember(null);
                }}
                placeholder="Type member name or code..."
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {isSearching && searchQuery.length >= 2 && (
                <div className="absolute right-3 top-2.5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                </div>
              )}
            </div>

            {/* Search Results */}
            {showResults && searchResults && searchResults.length > 0 && (
              <div className="mt-2 border rounded-md max-h-60 overflow-y-auto">
                {searchResults.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => handleSelectMember(member)}
                    className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                  >
                    <div className="font-medium">{member.full_name}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {member.member_code && <span className="mr-3">Code: {member.member_code}</span>}
                      {member.ikimina && <span>Group: {member.ikimina.name}</span>}
                    </div>
                    {member.total_balance !== undefined && (
                      <div className="text-xs text-gray-500 mt-1">
                        Balance: {formatCurrency(member.total_balance)}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {showResults && searchQuery.length >= 2 && searchResults?.length === 0 && !isSearching && (
              <div className="mt-2 p-4 text-center text-sm text-gray-500 border rounded-md">
                No members found matching "{searchQuery}"
              </div>
            )}
          </div>

          {/* Selected Member */}
          {selectedMember && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">Selected Member</h3>
              <div className="space-y-1 text-sm">
                <div className="font-medium">{selectedMember.full_name}</div>
                {selectedMember.member_code && (
                  <div className="text-blue-700">Code: {selectedMember.member_code}</div>
                )}
                {selectedMember.ikimina && (
                  <div className="text-blue-700">Group: {selectedMember.ikimina.name}</div>
                )}
                {selectedMember.total_balance !== undefined && (
                  <div className="text-blue-700">
                    Current Balance: {formatCurrency(selectedMember.total_balance)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isMatching}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleMatch}
            disabled={!selectedMember || isMatching}
            className={cn(
              "px-4 py-2 text-sm font-medium text-white rounded-md transition-colors",
              selectedMember && !isMatching
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-300 cursor-not-allowed"
            )}
          >
            {isMatching ? "Matching..." : "Confirm Match"}
          </button>
        </div>
      </div>
    </div>
  );
}

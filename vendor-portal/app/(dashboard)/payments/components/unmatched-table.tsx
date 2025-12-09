// ═══════════════════════════════════════════════════════════════════════════
// Unmatched SMS Table Component
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { formatCurrency, formatRelativeTime, cn } from "@/lib/utils";
import type { UnmatchedSMS } from "@/types/payment";

interface UnmatchedTableProps {
  smsMessages: UnmatchedSMS[];
  isLoading?: boolean;
  onMatchClick?: (sms: UnmatchedSMS) => void;
}

export function UnmatchedTable({ smsMessages, isLoading, onMatchClick }: UnmatchedTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="border rounded-lg">
        <div className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading unmatched SMS...</p>
        </div>
      </div>
    );
  }

  if (smsMessages.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <div className="text-green-600 mb-2">
          <svg
            className="w-12 h-12 mx-auto"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-muted-foreground font-medium">All SMS matched!</p>
        <p className="text-sm text-muted-foreground mt-1">No pending payments to review</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-orange-50 border-b">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-orange-900 uppercase">
              Received
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-orange-900 uppercase">
              Sender
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-orange-900 uppercase">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-orange-900 uppercase">
              Message
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-orange-900 uppercase">
              Action
            </th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {smsMessages.map((sms) => (
            <tr key={sms.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-sm">
                <div className="font-medium">{formatRelativeTime(sms.received_at)}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(sms.received_at).toLocaleString()}
                </div>
              </td>
              <td className="px-4 py-3 text-sm">
                <div className="font-medium">{sms.sender}</div>
                {sms.parsed_data?.sender_phone && (
                  <div className="text-xs text-muted-foreground">
                    {sms.parsed_data.sender_phone}
                  </div>
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                {sms.parsed_data?.amount ? (
                  <span className="font-medium text-green-600">
                    {formatCurrency(sms.parsed_data.amount)}
                  </span>
                ) : (
                  <span className="text-red-600 text-xs">Amount not parsed</span>
                )}
              </td>
              <td className="px-4 py-3 text-sm">
                <div className="max-w-md">
                  {expandedId === sms.id ? (
                    <div>
                      <p className="text-xs mb-2">{sms.message}</p>
                      <button
                        onClick={() => setExpandedId(null)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Show less
                      </button>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs truncate">{sms.message}</p>
                      <button
                        onClick={() => setExpandedId(sms.id)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Show more
                      </button>
                    </div>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm">
                <button
                  onClick={() => onMatchClick?.(sms)}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                >
                  Match Member
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

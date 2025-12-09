"use client";

import { useState } from "react";
import { Trans } from "@/components/common/trans";
import { X } from "lucide-react";
import type { MomoSmsInbox } from "../types";

type MomoSmsRow = MomoSmsInbox;

interface ManualMatchDialogProps {
  sms: MomoSmsRow;
  onClose: () => void;
  onMatch: () => void;
}

export function ManualMatchDialog({ sms, onClose, onMatch }: ManualMatchDialogProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isMatching, setIsMatching] = useState(false);

  const handleMatch = async (paymentId: string) => {
    setIsMatching(true);
    try {
      // TODO: Implement API call to manually match SMS to payment
      // await fetch('/api/momo-inbox/match', {
      //   method: 'POST',
      //   body: JSON.stringify({ smsId: sms.id, paymentId }),
      // });
      
      console.log("Matching SMS", sms.id, "to payment", paymentId);
      
      // For now, just simulate success
      setTimeout(() => {
        onMatch();
      }, 500);
    } catch (error) {
      console.error("Failed to match:", error);
      alert("Failed to match payment. Please try again.");
    } finally {
      setIsMatching(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="fixed inset-0 flex items-center justify-center z-[51] p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">
                <Trans k="momoInbox.match.title" defaultText="Match to Payment" />
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                <Trans
                  k="momoInbox.match.subtitle"
                  defaultText="Select a pending payment to match with this SMS"
                />
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* SMS Summary */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                <Trans k="momoInbox.match.smsInfo" defaultText="SMS Information" />
              </h3>
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    <Trans k="momoInbox.match.amount" defaultText="Amount:" />
                  </span>
                  <span className="ml-2 font-semibold">
                    {sms.parsed_amount
                      ? `GHS ${sms.parsed_amount.toFixed(2)}`
                      : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    <Trans k="momoInbox.match.sender" defaultText="Sender:" />
                  </span>
                  <span className="ml-2">{sms.parsed_sender_name || "-"}</span>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                    <Trans k="momoInbox.match.txnId" defaultText="Txn ID:" />
                  </span>
                  <span className="ml-2 font-mono text-xs">{sms.parsed_transaction_id || "-"}</span>
                </div>
              </div>
            </div>

            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <Trans k="momoInbox.match.search" defaultText="Search Pending Payments" />
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by member name, amount, or reference..."
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Pending Payments List */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                <Trans k="momoInbox.match.pendingPayments" defaultText="Pending Payments (Last 24 hours)" />
              </h3>
              
              {/* Placeholder - In real implementation, fetch from API */}
              <div className="space-y-2">
                <div className="text-center py-12 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                  <p>
                    <Trans
                      k="momoInbox.match.noPayments"
                      defaultText="No pending payments found matching this SMS amount"
                    />
                  </p>
                  <p className="text-sm mt-2">
                    <Trans
                      k="momoInbox.match.suggestion"
                      defaultText="Try searching by member name or reference"
                    />
                  </p>
                </div>
              </div>
            </div>

            {/* Information Note */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">
                <Trans k="momoInbox.match.note.title" defaultText="Matching Guidelines" />
              </h4>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 list-disc list-inside">
                <li>
                  <Trans
                    k="momoInbox.match.note.amount"
                    defaultText="Verify the amount matches exactly"
                  />
                </li>
                <li>
                  <Trans
                    k="momoInbox.match.note.timing"
                    defaultText="Check that the timing is reasonable (SMS should arrive after payment)"
                  />
                </li>
                <li>
                  <Trans
                    k="momoInbox.match.note.member"
                    defaultText="Confirm the member name matches or is similar"
                  />
                </li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isMatching}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Trans k="momoInbox.match.cancel" defaultText="Cancel" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

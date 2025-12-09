"use client";

import { Trans } from "@/components/common/trans";
import { X } from "lucide-react";
import { ManualMatchDialog } from "./ManualMatchDialog";
import { useState } from "react";
import type { MomoSmsInbox } from "../types";

type MomoSmsRow = MomoSmsInbox;

interface MomoSmsDetailProps {
  sms: MomoSmsRow;
  onClose: () => void;
}

export function MomoSmsDetail({ sms, onClose }: MomoSmsDetailProps) {
  const [showMatchDialog, setShowMatchDialog] = useState(false);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              <Trans k="momoInbox.detail.title" defaultText="SMS Details" />
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Status Banner */}
            {sms.processed ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/40 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-medium text-green-900 dark:text-green-100">
                      <Trans k="momoInbox.detail.matched" defaultText="Matched to Payment" />
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                      <Trans 
                        k="momoInbox.detail.confidence" 
                        defaultText="Confidence: {{confidence}}%"
                        values={{ confidence: ((sms.match_confidence || 0) * 100).toFixed(0) }}
                      />
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-medium text-amber-900 dark:text-amber-100">
                        <Trans k="momoInbox.detail.unmatched" defaultText="Not Matched" />
                      </h3>
                      <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                        <Trans k="momoInbox.detail.reviewRequired" defaultText="Manual review required" />
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowMatchDialog(true)}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Trans k="momoInbox.detail.matchManually" defaultText="Match Manually" />
                  </button>
                </div>
              </div>
            )}

            {/* Parsed Information */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                <Trans k="momoInbox.detail.parsedInfo" defaultText="Parsed Information" />
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    <Trans k="momoInbox.detail.amount" defaultText="Amount" />
                  </label>
                  <p className="text-lg font-semibold mt-1">
                    {sms.parsed_amount
                      ? `GHS ${sms.parsed_amount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    <Trans k="momoInbox.detail.sender" defaultText="Sender Name" />
                  </label>
                  <p className="text-lg font-semibold mt-1">{sms.parsed_sender_name || "-"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    <Trans k="momoInbox.detail.transactionId" defaultText="Transaction ID" />
                  </label>
                  <p className="text-sm font-mono mt-1 text-gray-900 dark:text-gray-100">
                    {sms.parsed_transaction_id || "-"}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    <Trans k="momoInbox.detail.provider" defaultText="Provider" />
                  </label>
                  <p className="text-sm mt-1 uppercase font-medium">
                    {sms.parsed_provider || "Unknown"}
                  </p>
                </div>
              </div>
            </div>

            {/* Raw Message */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                <Trans k="momoInbox.detail.rawMessage" defaultText="Raw SMS Message" />
              </h3>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                  {sms.raw_message}
                </p>
              </div>
            </div>

            {/* Metadata */}
            <div>
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                <Trans k="momoInbox.detail.metadata" defaultText="Metadata" />
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    <Trans k="momoInbox.detail.phoneNumber" defaultText="Phone Number" />
                  </label>
                  <p className="mt-1 font-mono">{sms.phone_number}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    <Trans k="momoInbox.detail.smsSender" defaultText="SMS Sender" />
                  </label>
                  <p className="mt-1">{sms.sender || "-"}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    <Trans k="momoInbox.detail.receivedAt" defaultText="Received At" />
                  </label>
                  <p className="mt-1">{new Date(sms.received_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400">
                    <Trans k="momoInbox.detail.deviceId" defaultText="Device ID" />
                  </label>
                  <p className="mt-1 font-mono text-xs truncate">{sms.device_id || "-"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
            >
              <Trans k="momoInbox.detail.close" defaultText="Close" />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Match Dialog */}
      {showMatchDialog && (
        <ManualMatchDialog
          sms={sms}
          onClose={() => setShowMatchDialog(false)}
          onMatch={() => {
            setShowMatchDialog(false);
            onClose();
          }}
        />
      )}
    </>
  );
}

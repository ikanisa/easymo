"use client";

import { useState } from "react";
import { Trans } from "@/components/common/trans";
import { StatusChip } from "@/components/common/status-chip";
import { MomoSmsDetail } from "./MomoSmsDetail";
import { formatDistanceToNow } from "date-fns";
import type { MomoSmsInbox } from "../types";

type MomoSmsRow = MomoSmsInbox;

interface MomoInboxTableProps {
  messages: MomoSmsRow[];
}

export function MomoInboxTable({ messages }: MomoInboxTableProps) {
  const [selectedSms, setSelectedSms] = useState<MomoSmsRow | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "matched" | "pending">("all");

  // Filter messages based on status
  const filteredMessages = messages.filter((msg) => {
    if (filterStatus === "matched") return msg.processed;
    if (filterStatus === "pending") return !msg.processed;
    return true;
  });

  // Provider badge colors
  const getProviderColor = (provider: string | null) => {
    switch (provider) {
      case "mtn":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "vodafone":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "airteltigo":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";
    }
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          <Trans k="momoInbox.table.title" defaultText="Recent Messages" />
        </h2>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterStatus("all")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "all"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <Trans k="momoInbox.filter.all" defaultText="All" />
          </button>
          <button
            onClick={() => setFilterStatus("matched")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "matched"
                ? "bg-green-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <Trans k="momoInbox.filter.matched" defaultText="Matched" />
          </button>
          <button
            onClick={() => setFilterStatus("pending")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === "pending"
                ? "bg-amber-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            <Trans k="momoInbox.filter.pending" defaultText="Pending" />
          </button>
        </div>
      </div>

      {/* Messages Table */}
      {filteredMessages.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Trans k="momoInbox.empty" defaultText="No messages found" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 dark:border-gray-700">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <Trans k="momoInbox.table.received" defaultText="Received" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <Trans k="momoInbox.table.provider" defaultText="Provider" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <Trans k="momoInbox.table.amount" defaultText="Amount" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <Trans k="momoInbox.table.sender" defaultText="Sender" />
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <Trans k="momoInbox.table.status" defaultText="Status" />
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <Trans k="momoInbox.table.actions" defaultText="Actions" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredMessages.map((msg) => (
                <tr
                  key={msg.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedSms(msg)}
                >
                  <td className="py-3 px-4 text-sm">
                    <div className="text-gray-900 dark:text-gray-100">
                      {formatDistanceToNow(new Date(msg.received_at), { addSuffix: true })}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(msg.received_at).toLocaleString()}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getProviderColor(
                        msg.parsed_provider
                      )}`}
                    >
                      {msg.parsed_provider?.toUpperCase() || "UNKNOWN"}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {msg.parsed_amount
                        ? `GHS ${msg.parsed_amount.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`
                        : "-"}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700 dark:text-gray-300">
                    {msg.parsed_sender_name || "-"}
                  </td>
                  <td className="py-3 px-4">
                    {msg.processed ? (
                      <StatusChip status="success" label="Matched" />
                    ) : (
                      <StatusChip status="warning" label="Pending" />
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSms(msg);
                      }}
                      className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                    >
                      <Trans k="momoInbox.table.view" defaultText="View" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedSms && (
        <MomoSmsDetail sms={selectedSms} onClose={() => setSelectedSms(null)} />
      )}
    </>
  );
}

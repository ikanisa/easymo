// ═══════════════════════════════════════════════════════════════════════════
// Payments Dashboard Page
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import { usePayments, useUnmatchedSMS } from "@/lib/hooks/use-payments";
import { useStats } from "@/lib/hooks/use-stats";
import { PaymentStatsCards } from "./components/payment-stats";
import { PaymentFilters } from "./components/payment-filters";
import { PaymentsTable } from "./components/payments-table";
import { UnmatchedTable } from "./components/unmatched-table";
import { MatchModal } from "./components/match-modal";
import type { PaymentStatus, UnmatchedSMS } from "@/types/payment";

// TODO: Get from auth context or session
const DEMO_SACCO_ID = "00000000-0000-0000-0000-000000000000";

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<"all" | "unmatched">("all");
  const [selectedSMS, setSelectedSMS] = useState<UnmatchedSMS | null>(null);
  
  const [filters, setFilters] = useState<{
    status: PaymentStatus | "all";
    from_date?: string;
    to_date?: string;
  }>({
    status: "all",
  });

  // Fetch data
  const { data: stats, isLoading: isLoadingStats } = useStats(DEMO_SACCO_ID);
  
  const { data: paymentsData, isLoading: isLoadingPayments } = usePayments({
    sacco_id: DEMO_SACCO_ID,
    status: filters.status,
    from_date: filters.from_date,
    to_date: filters.to_date,
    limit: 50,
    offset: 0,
  });

  const { data: unmatchedData, isLoading: isLoadingUnmatched } = useUnmatchedSMS(
    DEMO_SACCO_ID,
    50,
    0
  );

  const handleMatchClick = (sms: UnmatchedSMS) => {
    setSelectedSMS(sms);
  };

  const handleCloseModal = () => {
    setSelectedSMS(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Payments</h1>
        <p className="text-muted-foreground mt-1">
          Track and manage SACCO member payments
        </p>
      </div>

      {/* Statistics */}
      <PaymentStatsCards
        stats={stats?.data || {
          members: { total: 0 },
          groups: { total: 0 },
          payments: {
            total: 0,
            total_amount: 0,
            matched: 0,
            unmatched: 0,
            today_count: 0,
            today_amount: 0,
            match_rate: 0,
          },
          savings: { total: 0, currency: "RWF" },
        }}
        isLoading={isLoadingStats}
      />

      {/* Tabs */}
      <div className="border-b">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("all")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "all"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            All Payments
            {paymentsData && (
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-gray-100 text-gray-600">
                {paymentsData.pagination.total}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("unmatched")}
            className={`
              py-4 px-1 border-b-2 font-medium text-sm transition-colors
              ${activeTab === "unmatched"
                ? "border-orange-500 text-orange-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }
            `}
          >
            Unmatched SMS
            {unmatchedData && unmatchedData.pagination.total > 0 && (
              <span className="ml-2 py-0.5 px-2 rounded-full text-xs bg-orange-100 text-orange-600 font-semibold">
                {unmatchedData.pagination.total}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === "all" ? (
        <div className="space-y-4">
          <PaymentFilters onFilterChange={setFilters} />
          <PaymentsTable
            payments={paymentsData?.data || []}
            isLoading={isLoadingPayments}
          />
          {paymentsData && paymentsData.pagination.total > 50 && (
            <div className="text-center text-sm text-muted-foreground">
              Showing {paymentsData.data.length} of {paymentsData.pagination.total} payments
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Payments that could not be automatically matched to members
            </p>
            {unmatchedData && unmatchedData.pagination.total > 0 && (
              <span className="text-sm font-medium text-orange-600">
                {unmatchedData.pagination.total} pending review
              </span>
            )}
          </div>
          <UnmatchedTable
            smsMessages={unmatchedData?.data || []}
            isLoading={isLoadingUnmatched}
            onMatchClick={handleMatchClick}
          />
        </div>
      )}

      {/* Match Modal */}
      {selectedSMS && (
        <MatchModal
          sms={selectedSMS}
          saccoId={DEMO_SACCO_ID}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}

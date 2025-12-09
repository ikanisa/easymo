// ═══════════════════════════════════════════════════════════════════════════
// Payment Filters Component
// ═══════════════════════════════════════════════════════════════════════════

"use client";

import { useState } from "react";
import type { PaymentStatus } from "@/types/payment";

interface PaymentFiltersProps {
  onFilterChange: (filters: {
    status: PaymentStatus | "all";
    from_date?: string;
    to_date?: string;
  }) => void;
}

export function PaymentFilters({ onFilterChange }: PaymentFiltersProps) {
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const handleStatusChange = (newStatus: PaymentStatus | "all") => {
    setStatus(newStatus);
    onFilterChange({
      status: newStatus,
      from_date: fromDate || undefined,
      to_date: toDate || undefined,
    });
  };

  const handleDateChange = (field: "from" | "to", value: string) => {
    if (field === "from") {
      setFromDate(value);
      onFilterChange({
        status,
        from_date: value || undefined,
        to_date: toDate || undefined,
      });
    } else {
      setToDate(value);
      onFilterChange({
        status,
        from_date: fromDate || undefined,
        to_date: value || undefined,
      });
    }
  };

  const clearFilters = () => {
    setStatus("all");
    setFromDate("");
    setToDate("");
    onFilterChange({ status: "all" });
  };

  return (
    <div className="flex flex-wrap items-center gap-4 p-4 border rounded-lg bg-card">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">Status:</label>
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value as PaymentStatus | "all")}
          className="px-3 py-1.5 border rounded-md text-sm"
        >
          <option value="all">All</option>
          <option value="matched">Matched</option>
          <option value="pending">Pending</option>
          <option value="unmatched">Unmatched</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">From:</label>
        <input
          type="date"
          value={fromDate}
          onChange={(e) => handleDateChange("from", e.target.value)}
          className="px-3 py-1.5 border rounded-md text-sm"
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">To:</label>
        <input
          type="date"
          value={toDate}
          onChange={(e) => handleDateChange("to", e.target.value)}
          className="px-3 py-1.5 border rounded-md text-sm"
        />
      </div>

      {(status !== "all" || fromDate || toDate) && (
        <button
          onClick={clearFilters}
          className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}

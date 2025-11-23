"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  label?: string;
  value?: string;
  onChange?: (date: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

export function DatePicker({
  label,
  value,
  onChange,
  placeholder = "Select date",
  error,
  disabled,
}: DatePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-gray-900">{label}</label>
      )}
      <div className="relative">
        <input
          type="date"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          className={cn(
            "w-full rounded-lg border border-gray-300 bg-white px-4 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-50",
            error && "border-red-500 focus:border-red-500 focus:ring-red-500"
          )}
        />
        <Calendar className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

interface DateRangePickerProps {
  label?: string;
  startDate?: string;
  endDate?: string;
  onStartDateChange?: (date: string) => void;
  onEndDateChange?: (date: string) => void;
  error?: string;
  disabled?: boolean;
}

export function DateRangePicker({
  label,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  error,
  disabled,
}: DateRangePickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {label && (
        <label className="text-sm font-medium text-gray-900">{label}</label>
      )}
      <div className="grid grid-cols-2 gap-3">
        <DatePicker
          placeholder="Start date"
          value={startDate}
          onChange={onStartDateChange}
          disabled={disabled}
        />
        <DatePicker
          placeholder="End date"
          value={endDate}
          onChange={onEndDateChange}
          disabled={disabled}
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

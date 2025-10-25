"use client";

import { useMemo } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import "react-day-picker/dist/style.css";

interface DateRangePickerProps {
  value: { from?: Date; to?: Date };
  onChange: (range: { from?: Date; to?: Date }) => void;
}

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const range = useMemo(() => {
    if (value.from && value.to) return { from: value.from, to: value.to } as DateRange;
    if (value.from) return { from: value.from, to: value.from } as DateRange;
    return undefined;
  }, [value]);

  return (
    <div className="rounded-xl border border-[color:var(--color-border)]/60 bg-white px-3 py-2">
      <DayPicker
        mode="range"
        selected={range}
        onSelect={(selected) => onChange({ from: selected?.from, to: selected?.to })}
        numberOfMonths={2}
      />
    </div>
  );
}

"use client";

import { useId } from "react";
import { DateRangePicker } from "@/components/ui/DateRangePicker";

export type VoiceFilterState = {
  status?: string;
  channel?: string;
  search?: string;
  from?: Date;
  to?: Date;
};

interface VoiceFiltersProps {
  value: VoiceFilterState;
  onChange: (value: VoiceFilterState) => void;
}

export function VoiceFilters({ value, onChange }: VoiceFiltersProps) {
  const statusId = useId();
  const channelId = useId();
  const searchId = useId();

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <label className="text-sm">
        <span className="text-[color:var(--color-muted)]">Status</span>
        <select
          id={statusId}
          className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-transparent px-3 py-2"
          value={value.status ?? ""}
          onChange={(event) => onChange({ ...value, status: event.target.value || undefined })}
        >
          <option value="">All</option>
          <option value="in-progress">In progress</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="no-answer">No answer</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="text-[color:var(--color-muted)]">Channel</span>
        <select
          id={channelId}
          className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-transparent px-3 py-2"
          value={value.channel ?? ""}
          onChange={(event) => onChange({ ...value, channel: event.target.value || undefined })}
        >
          <option value="">All</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="twilio">Twilio</option>
        </select>
      </label>
      <label className="text-sm md:col-span-2">
        <span className="text-[color:var(--color-muted)]">Search</span>
        <input
          id={searchId}
          className="mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-transparent px-3 py-2"
          placeholder="Search by phone, lead, or note"
          value={value.search ?? ""}
          onChange={(event) => onChange({ ...value, search: event.target.value || undefined })}
        />
      </label>
      <DateRangePicker
        value={{ from: value.from, to: value.to }}
        onChange={({ from, to }) => onChange({ ...value, from: from ?? undefined, to: to ?? undefined })}
      />
    </div>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { StatusChip } from "@/components/common/status-chip";

interface SmsInboxEntry {
  id: string;
  raw_text: string;
  parsed_json: Record<string, unknown> | null;
  msisdn: string | null;
  received_at: string;
  status: string;
  confidence: number | null;
  error: string | null;
}

interface SmsInboxPanelProps {
  items: SmsInboxEntry[];
}

const statusToneMap: Record<string, "success" | "warning" | "critical" | "neutral"> = {
  PARSED: "success",
  FAILED: "critical",
  PENDING_REVIEW: "warning",
  UNPARSED: "warning",
};

const confidenceToLabel = (confidence: number | null) => {
  if (confidence == null) return "—";
  return `${Math.round(confidence * 100)}%`;
};

export function SmsInboxPanel({ items }: SmsInboxPanelProps) {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const statuses = useMemo(() => {
    const unique = new Set(items.map((item) => item.status));
    return ["ALL", ...Array.from(unique)];
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();

    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) {
        return false;
      }
      if (!query) return true;
      const haystack = `${item.raw_text} ${item.msisdn ?? ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [items, deferredSearch, statusFilter]);

  if (items.length === 0) {
    return <p className="text-sm text-neutral-2">No recent SMS messages found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Input
            label="Search SMS"
            placeholder="Search text or MSISDN"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-2">
          <label htmlFor="sms-status">Status</label>
          <select
            id="sms-status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs uppercase tracking-[0.3em] text-neutral-0 focus:outline-none focus:ring-2 focus:ring-rw-blue"
          >
            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        {filteredItems.map((item) => (
          <article
            key={item.id}
            className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-glass"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="text-sm text-neutral-2">
                <p className="font-semibold text-neutral-0">{item.msisdn ?? "Unknown number"}</p>
                <p>{new Date(item.received_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.3em]">
                <StatusChip tone={statusToneMap[item.status] ?? "neutral"}>
                  {item.status}
                </StatusChip>
                <span className="rounded-full border border-white/15 px-3 py-1 text-neutral-2">
                  Confidence: {confidenceToLabel(item.confidence)}
                </span>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">Raw SMS</p>
                <pre className="mt-1 max-h-48 overflow-y-auto rounded-2xl bg-black/30 p-3 text-xs text-neutral-0">
                  {item.raw_text}
                </pre>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-neutral-2">Parsed</p>
                {item.parsed_json ? (
                  <pre className="mt-1 max-h-48 overflow-y-auto rounded-2xl bg-black/30 p-3 text-xs text-neutral-0">
                    {JSON.stringify(item.parsed_json, null, 2)}
                  </pre>
                ) : (
                  <p className="mt-1 text-xs text-neutral-2">No parser output yet.</p>
                )}
              </div>
            </div>
            {item.error && <p className="mt-3 text-xs text-amber-200">Error: {item.error}</p>}
          </article>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <p className="text-sm text-neutral-2">No SMS messages match your filters.</p>
      )}
    </div>
  );
}

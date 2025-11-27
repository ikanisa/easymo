"use client";

import clsx from "clsx";

export interface AtlasRequestRow {
  id: string;
  channel: "voice" | "chat" | "email" | "api" | string;
  customer: string;
  status: "new" | "assigned" | "escalated" | "resolved" | string;
  etaMinutes: number;
  summary: string;
}

export interface RequestTableProps {
  title?: string;
  requests: AtlasRequestRow[];
  onSelect?: (request: AtlasRequestRow) => void;
  className?: string;
}

const statusAccent: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  assigned: "bg-amber-100 text-amber-700",
  escalated: "bg-rose-100 text-rose-700",
  resolved: "bg-emerald-100 text-emerald-700",
};

export function RequestTable({ title = "Live requests", requests, onSelect, className }: RequestTableProps) {
  return (
    <section
      className={clsx(
        "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-100">{title}</h3>
        <span className="text-xs text-slate-400" aria-live="polite">
          {requests.length} open
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-2 font-semibold">
                Request
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Channel
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                SLA (min)
              </th>
              <th scope="col" className="px-4 py-2 font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => {
              const accent = statusAccent[request.status] ?? "bg-slate-200 text-slate-700";
              return (
                <tr
                  key={request.id}
                  className={clsx(
                    "border-t border-slate-100/60 transition hover:bg-slate-50 focus-within:bg-slate-50 dark:border-slate-800/60",
                    "dark:hover:bg-slate-800/60",
                  )}
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className={clsx(
                        "flex w-full flex-col items-start gap-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900",
                        !onSelect && "cursor-default text-left",
                      )}
                      onClick={onSelect ? () => onSelect(request) : undefined}
                      disabled={!onSelect}
                    >
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {request.summary}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{request.customer}</span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-xs capitalize text-slate-500 dark:text-slate-400">{request.channel}</td>
                  <td className="px-4 py-3 text-xs tabular-nums text-slate-600 dark:text-slate-300">{request.etaMinutes}</td>
                  <td className="px-4 py-3">
                    <span className={clsx("inline-flex rounded-full px-2.5 py-1 text-xs font-medium", accent)}>
                      {request.status}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}


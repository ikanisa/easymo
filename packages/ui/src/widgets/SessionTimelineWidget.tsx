"use client";

import { clsx } from "clsx";

export type SessionTimelineStatus = "completed" | "active" | "upcoming";

export interface SessionTimelineEvent {
  id: string;
  label: string;
  timestamp: string;
  status: SessionTimelineStatus;
  description?: string;
  actor?: string;
}

interface SessionTimelineWidgetProps {
  events: SessionTimelineEvent[];
  className?: string;
}

const statusTone: Record<SessionTimelineStatus, string> = {
  completed: "bg-emerald-500",
  active: "bg-sky-400 animate-pulse",
  upcoming: "bg-slate-300",
};

export function SessionTimelineWidget({ events, className }: SessionTimelineWidgetProps) {
  return (
    <div
      className={clsx(
        "rounded-3xl border border-slate-200/70 bg-white/90 p-5 shadow-[0_20px_50px_rgba(15,23,42,0.12)]",
        className,
      )}
    >
      <ol className="relative ml-3 space-y-5 border-l border-slate-100">
        {events.map((event) => (
          <li key={event.id} className="pl-6">
            <span
              className={clsx(
                "absolute -left-[7px] flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white",
                statusTone[event.status],
              )}
              aria-hidden="true"
            />
            <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-slate-400">
              <span>{event.timestamp}</span>
              {event.actor ? <span className="text-slate-500">{event.actor}</span> : null}
            </div>
            <p className="mt-1 text-base font-semibold text-slate-900">{event.label}</p>
            {event.description ? (
              <p className="text-sm text-slate-600">{event.description}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

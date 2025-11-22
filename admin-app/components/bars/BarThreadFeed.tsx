"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import type { BarThreadEvent } from "@/lib/bars/bars-dashboard-service";

interface BarThreadFeedProps {
  events: BarThreadEvent[];
}

export function BarThreadFeed({ events }: BarThreadFeedProps) {
  if (!events.length) {
    return <EmptyState title="No WhatsApp activity" description="Messages will surface once the AI waiter engages guests." />;
  }

  return (
    <ol className="space-y-3">
      {events.map((event) => (
        <li
          key={event.id}
          className={`rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-sm ${event.direction === "assistant" ? "bg-[color:var(--color-accent)]/10" : "bg-white"}`}
        >
          <div className="flex items-center justify-between text-xs text-[color:var(--color-muted)]">
            <span className="font-medium text-[color:var(--color-foreground)]">
              {event.direction === "assistant" ? event.agent ?? "EasyMO" : "Guest"}
            </span>
            <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-[color:var(--color-foreground)]">{event.content}</p>
        </li>
      ))}
    </ol>
  );
}

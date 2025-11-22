"use client";

import { EmptyState } from "@/components/ui/EmptyState";
import type { KitchenTicket } from "@/lib/bars/bars-dashboard-service";

interface BarKitchenFeedProps {
  tickets: KitchenTicket[];
}

function statusTone(status: string) {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-700";
    case "preparing":
      return "bg-blue-100 text-blue-700";
    case "served":
      return "bg-emerald-100 text-emerald-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function BarKitchenFeed({ tickets }: BarKitchenFeedProps) {
  if (!tickets.length) {
    return <EmptyState title="Kitchen queue is empty" description="New WhatsApp orders will appear here instantly." />;
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => (
        <div key={ticket.id} className="rounded-2xl border border-[color:var(--color-border)] bg-white/70 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-base font-semibold text-[color:var(--color-foreground)]">#{ticket.orderCode}</h4>
              <p className="text-xs text-[color:var(--color-muted)]">Table {ticket.table}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusTone(ticket.status)}`}>
              {ticket.status}
            </span>
          </div>
          <ul className="mt-3 grid gap-2 text-sm md:grid-cols-2">
            {ticket.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between rounded-xl border border-[color:var(--color-border)]/40 px-3 py-2">
                <span className="font-medium text-[color:var(--color-foreground)]">
                  {item.quantity}× {item.name}
                </span>
                <span className="text-xs text-[color:var(--color-muted)]">{item.status}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[color:var(--color-muted)]">
            Placed at {new Date(ticket.createdAt).toLocaleTimeString()}
          </p>
        </div>
      ))}
    </div>
  );
}

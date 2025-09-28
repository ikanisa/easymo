import type { OrderEvent } from '@/lib/schemas';

interface OrderEventsListProps {
  events: OrderEvent[];
}

export function OrderEventsList({ events }: OrderEventsListProps) {
  if (!events.length) {
    return (
      <p className="text-sm text-[color:var(--color-muted)]">
        No recent order events.
      </p>
    );
  }

  return (
    <ol className="space-y-3" aria-label="Latest order events">
      {events.map((event) => (
        <li
          key={event.id}
          className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/55 px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="block text-sm text-[color:var(--color-foreground)]">
                {event.orderId}
              </strong>
              <p className="text-sm text-[color:var(--color-muted)]">
                {event.type} • {new Date(event.createdAt).toLocaleString()}
              </p>
            </div>
            {event.note ? (
              <span className="rounded-full border border-[color:var(--color-border)]/30 bg-[color:var(--color-surface)]/70 px-3 py-1 text-xs text-[color:var(--color-muted)]">
                {event.note}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

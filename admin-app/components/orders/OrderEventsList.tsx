import type { OrderEvent } from '@/lib/schemas';

interface OrderEventsListProps {
  events: OrderEvent[];
}

export function OrderEventsList({ events }: OrderEventsListProps) {
  if (!events.length) {
    return <p className="cell-muted">No recent order events.</p>;
  }

  return (
    <ol className="timeline" aria-label="Latest order events">
      {events.map((event) => (
        <li key={event.id} className="timeline__item">
          <div>
            <strong>{event.orderId}</strong>
            <p className="cell-muted">
              {event.type} • {new Date(event.createdAt).toLocaleString()}
            </p>
          </div>
          {event.note ? <p>{event.note}</p> : null}
        </li>
      ))}
    </ol>
  );
}

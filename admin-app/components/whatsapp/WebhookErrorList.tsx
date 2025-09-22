import type { WebhookError } from '@/lib/schemas';

interface WebhookErrorListProps {
  errors: WebhookError[];
}

export function WebhookErrorList({ errors }: WebhookErrorListProps) {
  if (!errors.length) {
    return <p className="cell-muted">No webhook errors detected.</p>;
  }

  return (
    <ul className="cards-list">
      {errors.map((error) => (
        <li key={error.id} className="cards-list__item">
          <strong>{error.endpoint}</strong>
          <p className="cell-muted">
            {error.failureReason}
            <br />
            {new Date(error.createdAt).toLocaleString()}
          </p>
          {error.retryUrl ? (
            <a href={error.retryUrl} className="link-muted">
              Retry
            </a>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

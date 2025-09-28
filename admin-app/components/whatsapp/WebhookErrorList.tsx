import type { WebhookError } from '@/lib/schemas';

interface WebhookErrorListProps {
  errors: WebhookError[];
}

export function WebhookErrorList({ errors }: WebhookErrorListProps) {
  if (!errors.length) {
    return (
      <p className="text-sm text-[color:var(--color-muted)]">
        No webhook errors detected.
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {errors.map((error) => (
        <li
          key={error.id}
          className="rounded-2xl border border-[color:var(--color-border)]/40 bg-[color:var(--color-surface)]/60 px-4 py-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <strong className="block text-sm text-[color:var(--color-foreground)]">
                {error.endpoint}
              </strong>
              <p className="text-sm text-[color:var(--color-muted)]">
                {error.failureReason}
                <br />
                {new Date(error.createdAt).toLocaleString()}
              </p>
            </div>
            {error.retryUrl ? (
              <a
                href={error.retryUrl}
                className="rounded-full border border-[color:var(--color-border)]/40 px-3 py-1 text-xs font-medium text-[color:var(--color-accent)] transition hover:border-[color:var(--color-accent)]/40 hover:bg-[color:var(--color-accent)]/10"
              >
                Retry
              </a>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

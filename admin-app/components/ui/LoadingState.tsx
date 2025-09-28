import classNames from 'classnames';

interface LoadingStateProps {
  title?: string;
  description?: string;
  message?: string;
  className?: string;
}

export function LoadingState({ title, description, message = 'Loading…', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={classNames(
        'flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[color:var(--color-border)]/60',
        'bg-[color:var(--color-surface)]/40 px-6 py-10 text-center backdrop-blur-xl',
        className
      )}
    >
      <svg
        className="h-8 w-8 animate-spin text-[color:var(--color-accent)]"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
      </svg>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[color:var(--color-foreground)]">
          {title ?? message}
        </p>
        {description ? (
          <p className="text-sm text-[color:var(--color-muted)]">{description}</p>
        ) : null}
      </div>
    </div>
  );
}

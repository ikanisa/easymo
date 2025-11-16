import { clsx } from "clsx";

export interface LoadingStateProps {
  title?: string;
  description?: string;
  message?: string;
  className?: string;
}

export function LoadingState({ title, description, message = "Loading…", className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed",
        "border-[color:var(--ui-color-border)]/70 bg-[color:var(--ui-color-surface)]/60 px-8 py-10 text-center shadow-[var(--ui-elevation-low,0_1px_2px_rgba(7,11,26,0.2))]",
        "backdrop-blur-xl",
        className,
      )}
    >
      <svg
        className="h-8 w-8 animate-spin text-[color:var(--ui-color-accent)]"
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
          fill="none"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <div className="space-y-1">
        <p className="text-sm font-medium text-[color:var(--ui-color-foreground)]">{title ?? message}</p>
        {description ? <p className="text-sm text-[color:var(--ui-color-muted)]">{description}</p> : null}
      </div>
    </div>
  );
}

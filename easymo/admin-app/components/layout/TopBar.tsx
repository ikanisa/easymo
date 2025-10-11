import classNames from "classnames";
import { Button } from "@/components/ui/Button";

interface TopBarProps {
  environmentLabel: string;
  onOpenAssistant?: () => void;
}

const alertsSummary = {
  webhook: 0,
  ocr: 0,
};

export function TopBar({ environmentLabel, onOpenAssistant }: TopBarProps) {
  return (
    <header
      role="banner"
      aria-label="Admin panel top bar"
      className={classNames(
        "topbar",
        "sticky top-0 z-40 grid items-center gap-4 border-b border-[color:var(--color-border)]/60",
        "bg-[color:var(--color-surface)]/85 px-6 py-4 backdrop-blur-xl shadow-[var(--elevation-low)]",
        "md:grid-cols-[220px_1fr_auto]",
      )}
    >
      <div
        className={classNames(
          "topbar__env",
          "flex flex-col gap-1 text-xs uppercase tracking-[0.28em] text-[color:var(--color-muted)]",
        )}
        aria-live="polite"
      >
        <span className="topbar__env-label text-[0.65rem]">Environment</span>
        <span className="topbar__env-value text-sm font-semibold tracking-tight text-[color:var(--color-foreground)]">
          {environmentLabel}
        </span>
      </div>
      <div className="topbar__search relative">
        <label className="visually-hidden" htmlFor="global-search">
          Global search
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="Search orders, customers, menus…"
          aria-label="Global search"
          className="w-full rounded-full border border-[color:var(--color-border)]/50 bg-white/90 px-5 py-2 text-sm text-[color:var(--color-foreground)] shadow-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/40"
        />
      </div>
      <div
        className={classNames(
          "topbar__actions",
          "flex items-center gap-3 justify-end",
        )}
      >
        <Button
          type="button"
          variant="default"
          className="topbar__assistant inline-flex items-center gap-2 px-4"
          aria-label="Open assistant"
          onClick={onOpenAssistant}
          offlineBehavior="allow"
        >
          Assistant
        </Button>
        <Button
          type="button"
          variant="outline"
          className="topbar__alerts inline-flex items-center gap-2 px-4"
          aria-label="View alerts"
        >
          Alerts
          <span className="topbar__badge inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-[color:var(--color-accent)]/90 px-2 text-xs font-semibold text-[color:var(--color-accent-foreground)]">
            {alertsSummary.webhook + alertsSummary.ocr}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="topbar__profile inline-flex items-center gap-3 px-4"
          aria-label="Open profile menu"
        >
          <span className="topbar__avatar inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-accent)]/85 text-sm font-semibold text-[color:var(--color-accent-foreground)]">
            OP
          </span>
          <span className="topbar__profile-text text-sm font-semibold">
            Operations
          </span>
        </Button>
      </div>
    </header>
  );
}

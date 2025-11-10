"use client";

import { useMemo } from "react";
import classNames from "classnames";
import { Button } from "@/components/ui/Button";
import { useIntegrationStatusQuery } from "@/lib/queries/integrations";

interface TopBarProps {
  environmentLabel: string;
  onOpenNavigation?: () => void;
  onOpenAssistant?: () => void;
  assistantEnabled?: boolean;
  actorLabel?: string;
  actorInitials?: string;
  signingOut?: boolean;
  onSignOut?: () => void;
}

export function TopBar(
  {
    environmentLabel,
    onOpenAssistant,
    onOpenNavigation,
    assistantEnabled = false,
    actorLabel,
    actorInitials = "OP",
    signingOut = false,
    onSignOut,
  }: TopBarProps,
) {
  const integrationStatusQuery = useIntegrationStatusQuery({
    refetchInterval: 120_000,
  } as any);

  const { badgeLabel, badgeValue } = useMemo(() => {
    if (integrationStatusQuery.isLoading) {
      return {
        badgeValue: "…",
        badgeLabel: "Checking integration health",
      };
    }

    if (integrationStatusQuery.isError || !integrationStatusQuery.data) {
      return {
        badgeValue: "!",
        badgeLabel: "Unable to load integration status",
      };
    }

    const degraded = Object.values(integrationStatusQuery.data).filter(
      (entry) => entry.status !== "green",
    ).length;

    return {
      badgeValue: String(degraded),
      badgeLabel:
        degraded === 0
          ? "All integrations healthy"
          : `${degraded} integration${degraded === 1 ? "" : "s"} need attention`,
    };
  }, [integrationStatusQuery.data, integrationStatusQuery.isError, integrationStatusQuery.isLoading]);

  return (
    <header
      role="banner"
      aria-label="Admin panel top bar"
      className={classNames(
        "topbar",
        "sticky top-0 z-40 grid items-center gap-4 border-b border-[color:var(--color-border)]/60",
        "bg-[color:var(--color-surface)]/85 px-4 py-4 backdrop-blur-xl shadow-[var(--elevation-low)]",
        "md:grid-cols-[auto_1fr_auto] md:px-6",
      )}
    >
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium md:hidden"
          aria-label="Open navigation"
          onClick={onOpenNavigation}
        >
          Menu
        </Button>
        <div
          className={classNames(
            "topbar__env",
            "flex flex-col gap-1 text-[0.6rem] uppercase tracking-[0.28em] text-[color:var(--color-muted)]",
          )}
          aria-live="polite"
        >
          <span className="topbar__env-label text-[0.65rem]">Environment</span>
          <span className="topbar__env-value text-sm font-semibold tracking-tight text-[color:var(--color-foreground)]">
            {environmentLabel}
          </span>
        </div>
      </div>
      <div className="topbar__search relative">
        <label className="visually-hidden" htmlFor="global-search">
          Global search
        </label>
        <input
          id="global-search"
          type="search"
          placeholder="Search customers, vendors, menus…"
          aria-label="Global search"
          className="w-full rounded-full border border-[color:var(--color-border)]/50 bg-white/90 px-5 py-2 text-sm text-[color:var(--color-foreground)] shadow-sm outline-none transition focus:border-[color:var(--color-accent)] focus:ring-2 focus:ring-[color:var(--color-accent)]/40"
        />
      </div>
      <div
        className={classNames(
          "topbar__actions",
          "flex items-center gap-3 justify-end",
          { "topbar__actions--no-assistant": !assistantEnabled },
        )}
      >
        {assistantEnabled && (
          <Button
            type="button"
            variant="outline"
            className="topbar__assistant inline-flex items-center gap-2 px-4"
            aria-label="Open assistant"
            onClick={onOpenAssistant}
            offlineBehavior="allow"
          >
            Assistant
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          className="topbar__alerts inline-flex items-center gap-2 px-4"
          aria-label={badgeLabel}
        >
          Alerts
          <span
            className="topbar__badge inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-[color:var(--color-accent)]/90 px-2 text-xs font-semibold text-[color:var(--color-accent-foreground)]"
            role="status"
            aria-live="polite"
            title={badgeLabel}
          >
            {badgeValue}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="topbar__profile inline-flex items-center gap-3 px-4"
          aria-label="Sign out"
          onClick={onSignOut}
          disabled={signingOut}
          offlineBehavior="allow"
        >
          <span className="topbar__avatar inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--color-accent)]/85 text-sm font-semibold text-[color:var(--color-accent-foreground)]">
            {actorInitials}
          </span>
          <span className="topbar__profile-text flex flex-col items-start leading-tight">
            <span className="text-xs font-medium uppercase tracking-wide text-[color:var(--color-muted)]">
              Signed in as
            </span>
            <span className="text-sm font-semibold text-[color:var(--color-foreground)]">
              {actorLabel ?? "Administrator"}
            </span>
          </span>
          <span className="ml-2 text-sm font-semibold text-[color:var(--color-accent)]">
            {signingOut ? "Signing out…" : "Sign out"}
          </span>
        </Button>
      </div>
    </header>
  );
}

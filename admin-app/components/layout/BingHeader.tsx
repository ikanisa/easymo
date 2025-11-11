"use client";

import classNames from "classnames";

import { GlobalSearch } from "@/components/search/GlobalSearch";

interface BingHeaderProps {
  environmentLabel: string;
  onOpenNavigation?: () => void;
  assistantEnabled: boolean;
  onOpenAssistant?: () => void;
  actorLabel: string;
  actorInitials: string;
  onSignOut: () => Promise<void>;
  signingOut: boolean;
}

export function BingHeader({
  environmentLabel,
  onOpenNavigation,
  assistantEnabled,
  onOpenAssistant,
  actorLabel,
  actorInitials,
  onSignOut,
  signingOut,
}: BingHeaderProps) {
  return (
    <header className="bing-header" role="banner">
      <div className="bing-header__brand">
        <button
          type="button"
          className={classNames("bing-header__menu", {
            "bing-header__menu--visible": Boolean(onOpenNavigation),
          })}
          onClick={onOpenNavigation}
          aria-label="Open navigation"
        >
          ☰
        </button>
        <div className="bing-header__brand-meta">
          <p className="bing-header__title">easyMO Admin</p>
          <span className="bing-chip">{environmentLabel}</span>
        </div>
      </div>
      <div className="bing-search" role="search">
        <GlobalSearch placeholder="Search agents, requests, matches, logs…" />
      </div>
      <div className="bing-header__actions">
        <button
          type="button"
          className="bing-icon-button"
          aria-label="Notifications"
        >
          🔔
        </button>
        {assistantEnabled && (
          <button
            type="button"
            className="bing-icon-button"
            onClick={onOpenAssistant}
          >
            🤖
          </button>
        )}
        <button
          type="button"
          className="bing-icon-button"
          onClick={() => onSignOut()}
          disabled={signingOut}
        >
          {signingOut ? "…" : "⇦"}
          <span className="visually-hidden">Sign out</span>
        </button>
        <div className="bing-avatar" aria-label={actorLabel}>
          {actorInitials}
        </div>
      </div>
    </header>
  );
}

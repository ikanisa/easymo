"use client";

import { FormEvent, useState } from "react";
import classNames from "classnames";

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
  const [query, setQuery] = useState("");

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Placeholder: hook into omnichannel search once backend is ready
    window.dispatchEvent(
      new CustomEvent("admin-search", {
        detail: { query: query.trim() },
      }),
    );
  };

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
      <form className="bing-search" onSubmit={handleSearch} role="search">
        <label htmlFor="bing-search-input" className="visually-hidden">
          Search agents, requests, logs
        </label>
        <span className="bing-search__icon" aria-hidden>
          🔍
        </span>
        <input
          id="bing-search-input"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents, requests, matches, logs…"
        />
        <button type="submit" aria-label="Submit search">
          Go
        </button>
      </form>
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

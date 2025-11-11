"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import classNames from "classnames";
import { Search, HelpCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useIntegrationBadgeMetrics } from "@/lib/hooks/useIntegrationBadgeMetrics";
import { usePanelContext } from "@/components/layout/PanelContext";

interface TopBarProps {
  environmentLabel: string;
  onOpenNavigation?: () => void;
  onOpenAssistant?: () => void;
  assistantEnabled?: boolean;
  actorLabel?: string;
  actorInitials?: string;
  signingOut?: boolean;
  onSignOut?: () => void;
  omniSearchPlaceholder?: string;
  omniShortcutHint?: string;
}

interface ShortcutRow {
  label: string;
  keys: string[][];
}

function KeyStroke({ combo }: { combo: string[] }) {
  return (
    <span className="inline-flex items-center gap-1">
      {combo.map((key) => (
        <kbd
          key={key}
          className="rounded border border-[color:var(--color-border)]/60 bg-white/70 px-1.5 py-0.5 text-[0.65rem] font-medium text-[color:var(--color-muted)]"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

function useOutsideClick<T extends HTMLElement>(enabled: boolean, onClose: () => void) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: MouseEvent) => {
      if (!ref.current) return;
      if (event.target instanceof Node && !ref.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [enabled, onClose]);

  return ref;
}

function HelpPopover() {
  const panel = usePanelContext();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const containerRef = useOutsideClick<HTMLDivElement>(open, close);

  const shortcuts: ShortcutRow[] = useMemo(
    () => [
      { label: "Open Omnisearch", keys: [["⌘", "K"], ["Ctrl", "K"]] },
      { label: "Sidecar · Logs tab", keys: [["⌥", "1"]] },
      { label: "Sidecar · Tasks tab", keys: [["⌥", "2"]] },
      { label: "Sidecar · Policies tab", keys: [["⌥", "3"]] },
      { label: "Close sidecar", keys: [["⌥", "0"]] },
    ],
    [],
  );

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <HelpCircle className="h-4 w-4" aria-hidden />
        Help
      </Button>
      {open && (
        <div
          role="dialog"
          aria-label="Command center shortcuts"
          className="absolute right-0 z-[55] mt-2 w-80 overflow-hidden rounded-xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)] shadow-[var(--elevation-mid)]"
        >
          <div className="flex items-center justify-between border-b border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)]/90 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-foreground)]">
                Shortcuts
              </p>
              <p className="text-xs text-[color:var(--color-muted)]">
                One screen = one decision. Keep hands on the keyboard.
              </p>
            </div>
            <Button type="button" size="icon" variant="ghost" onClick={close} aria-label="Close help dialog">
              ×
            </Button>
          </div>
          <ul className="space-y-3 px-4 py-4 text-sm text-[color:var(--color-foreground)]">
            {shortcuts.map((shortcut) => (
              <li key={shortcut.label} className="flex items-center justify-between gap-4">
                <span>{shortcut.label}</span>
                <span className="flex flex-col items-end gap-1 text-[color:var(--color-muted)]">
                  {shortcut.keys.map((combo, index) => (
                    <KeyStroke key={`${shortcut.label}-${index}`} combo={combo} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)]/90 px-4 py-3 text-xs text-[color:var(--color-muted)]">
            <span>Use shortcuts to triage faster.</span>
            <button
              type="button"
              onClick={() => {
                close();
                panel.openCommandPalette();
              }}
              className="inline-flex items-center gap-1 text-[color:var(--color-accent)] transition hover:text-[color:var(--color-accent)]/80"
            >
              Try Omnisearch
              <ArrowRight className="h-3 w-3" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function TopBar({
  environmentLabel,
  onOpenAssistant,
  onOpenNavigation,
  assistantEnabled = false,
  actorLabel,
  actorInitials = "OP",
  signingOut = false,
  onSignOut,
  omniSearchPlaceholder,
  omniShortcutHint,
}: TopBarProps) {
  const panel = usePanelContext();
  const badgeMetrics = useIntegrationBadgeMetrics();
  const searchPlaceholder =
    omniSearchPlaceholder ?? "Search agents, requests, policies…";
  const showShortcutHint = Boolean(omniShortcutHint);

  return (
    <header
      role="banner"
      aria-label="Admin panel top bar"
      className={classNames(
        "topbar",
        "sticky top-0 z-40 grid items-center gap-4 border-b border-[color:var(--color-border)]/50",
        "bg-[color:var(--color-surface)]/80 px-4 py-4 backdrop-blur-xl shadow-[var(--shadow-ambient)]",
        "md:grid-cols-[auto_minmax(0,1fr)_auto] md:px-6",
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
        <button
          type="button"
          onClick={panel.openCommandPalette}
          className="flex w-full items-center gap-3 rounded-full border border-[color:var(--color-border)]/60 bg-white/90 px-5 py-2 text-sm text-[color:var(--color-muted)] shadow-sm transition hover:border-[color:var(--color-accent)]/70 hover:text-[color:var(--color-foreground)] focus:border-[color:var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--color-accent)]/40"
          aria-label="Open command palette"
          aria-haspopup="dialog"
          aria-expanded={panel.commandPaletteOpen}
        >
          <Search className="h-4 w-4" aria-hidden />
          <span className="flex-1 text-left">{searchPlaceholder}</span>
          <kbd className="rounded border border-[color:var(--color-border)]/60 bg-white/70 px-2 py-0.5 text-[0.65rem] font-medium text-[color:var(--color-muted)]">
            ⌘K
          </kbd>
        </button>
        {showShortcutHint && (
          <span className="topbar__shortcut" aria-hidden="true">
            {omniShortcutHint}
          </span>
        )}
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
          aria-label={badgeMetrics.badgeLabel}
        >
          Alerts
          <span
            className="topbar__badge inline-flex min-w-[1.75rem] items-center justify-center rounded-full bg-[color:var(--color-accent)]/90 px-2 text-xs」

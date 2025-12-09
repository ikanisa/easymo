"use client";

import { useEffect, useMemo, useRef } from "react";
import { Loader2, Eye, EyeOff, MessageSquare, PanelRightClose, PanelRightOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { useAssistant } from "@/providers/assistant-provider";

const FOCUSABLE_SELECTOR =
  'a[href]:not([tabindex="-1"]):not([aria-hidden="true"]),button:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]):not([tabindex="-1"]),input:not([disabled]):not([tabindex="-1"]),select:not([disabled]):not([tabindex="-1"]),[tabindex]:not([tabindex="-1"]):not([aria-hidden="true"])';

function getFocusableElements(container: HTMLElement | null) {
  if (!container) {
    return [] as HTMLElement[];
  }
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.offsetParent !== null
  );
}

export function AssistantVisibilityToggle() {
  const { isAssistantVisible, setAssistantVisible, isVisibilityLoading, isSyncingVisibility } =
    useAssistant();
  const busy = isVisibilityLoading || isSyncingVisibility;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isAssistantVisible}
      aria-label={isAssistantVisible ? "Hide Atlas assistant" : "Show Atlas assistant"}
      onClick={() => void setAssistantVisible(!isAssistantVisible)}
      disabled={busy}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-all",
        isAssistantVisible
          ? "border-atlas-blue/40 bg-atlas-blue/20 text-atlas-blue-dark hover:bg-atlas-blue/25"
          : "border-white/15 bg-white/5 text-neutral-0 hover:bg-white/10",
        busy && "cursor-wait opacity-70"
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
      ) : isAssistantVisible ? (
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span className="leading-none">Assistant</span>
    </button>
  );
}

export function AssistantLauncher() {
  const { isAssistantVisible, isOpen, toggleOpen, isVisibilityLoading } = useAssistant();

  if (!isAssistantVisible || isVisibilityLoading) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleOpen}
      aria-expanded={isOpen}
      aria-controls="atlas-assistant-panel"
      className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-0 transition-all hover:border-white/30 hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-atlas-blue/50 focus:ring-offset-2 focus:ring-offset-transparent"
      title="Toggle Atlas assistant (⌘⇧A / Ctrl⇧A)"
    >
      {isOpen ? (
        <PanelRightClose className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <PanelRightOpen className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span>Assistant</span>
    </button>
  );
}

export function AtlasAssistantSidebar() {
  const { isAssistantVisible, isOpen, setOpen, context, actions } = useAssistant();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isAssistantVisible || !isOpen) {
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    const focusable = getFocusableElements(container);
    (focusable[0] ?? container).focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") {
        return;
      }

      const elements = getFocusableElements(container);
      if (elements.length === 0) {
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const current = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (current === first || current === container) {
          event.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        event.preventDefault();
        first.focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      queueMicrotask(() => {
        const target = lastFocusedRef.current;
        target?.focus?.();
        lastFocusedRef.current = null;
      });
    };
  }, [isAssistantVisible, isOpen, setOpen]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    const { style } = document.body;
    const originalOverflow = style.overflow;
    if (isOpen) {
      style.overflow = "hidden";
    }
    return () => {
      style.overflow = originalOverflow;
    };
  }, [isOpen]);

  const hasContext = useMemo(() => {
    return Boolean(
      context.entity ||
        context.filters.length > 0 ||
        context.selections.length > 0 ||
        context.metrics.length > 0
    );
  }, [context.entity, context.filters.length, context.selections.length, context.metrics.length]);

  if (!isAssistantVisible) {
    return null;
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-neutral-950/60 backdrop-blur-sm transition-opacity duration-200 md:hidden",
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="atlas-assistant-panel"
        ref={containerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal={isOpen}
        aria-hidden={!isOpen}
        aria-labelledby="atlas-assistant-title"
        className={cn(
          "fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-[#0f172a]/95 p-6 text-neutral-0 shadow-2xl transition-transform duration-200 md:max-w-sm md:bg-white/90 md:text-ink",
          isOpen ? "translate-x-0" : "pointer-events-none translate-x-full"
        )}
      >
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.35em] text-atlas-blue/80">
              Atlas Copilot
            </p>
            <h2 id="atlas-assistant-title" className="text-lg font-bold text-white md:text-ink">
              Guided insights
            </h2>
            <p className="text-xs text-white/70 md:text-neutral-500">
              Context-aware suggestions based on what you are looking at.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-full border border-white/20 bg-white/10 p-2 text-white transition-all hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-atlas-blue/50 focus:ring-offset-2 focus:ring-offset-transparent md:text-ink"
            aria-label="Close assistant"
          >
            <PanelRightClose className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto pr-2">
          {hasContext ? (
            <section aria-label="Current context" className="space-y-4">
              {context.entity && (
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner md:border-neutral-200 md:bg-white">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-atlas-blue">
                    Active entity
                  </h3>
                  <p className="mt-2 text-sm font-semibold text-white md:text-ink">
                    {context.entity.name}
                  </p>
                  <p className="text-xs text-white/70 md:text-neutral-500">{context.entity.type}</p>
                  {context.entity.description && (
                    <p className="mt-3 text-xs text-white/70 md:text-neutral-500">
                      {context.entity.description}
                    </p>
                  )}
                </article>
              )}

              {context.filters.length > 0 && (
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner md:border-neutral-200 md:bg-white">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-atlas-blue">
                    Active filters
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {context.filters.map((filter) => (
                      <span
                        key={`${filter.label}-${filter.value}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-wide",
                          filter.active
                            ? "border-atlas-blue/60 bg-atlas-blue/20 text-white"
                            : "border-white/20 bg-white/10 text-white/80 md:border-neutral-200 md:bg-neutral-100 md:text-neutral-700"
                        )}
                      >
                        <span>{filter.label}</span>
                        <span className="font-normal">{filter.value}</span>
                      </span>
                    ))}
                  </div>
                </article>
              )}

              {context.selections.length > 0 && (
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner md:border-neutral-200 md:bg-white">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-atlas-blue">
                    Selected rows
                  </h3>
                  <ul className="mt-3 space-y-2 text-sm">
                    {context.selections.map((selection) => (
                      <li
                        key={selection.id}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 md:border-neutral-200 md:bg-neutral-50"
                      >
                        <p className="font-semibold text-white md:text-neutral-800">
                          {selection.label}
                        </p>
                        {selection.subtitle && (
                          <p className="text-xs text-white/70 md:text-neutral-500">
                            {selection.subtitle}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </article>
              )}

              {context.metrics.length > 0 && (
                <article className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-inner md:border-neutral-200 md:bg-white">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-atlas-blue">
                    Key metrics
                  </h3>
                  <dl className="mt-3 grid grid-cols-1 gap-3 text-sm">
                    {context.metrics.map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 md:border-neutral-200 md:bg-neutral-50"
                      >
                        <dt className="text-xs font-semibold uppercase tracking-[0.2em] text-white/70 md:text-neutral-500">
                          {metric.label}
                        </dt>
                        <dd className="mt-1 text-base font-semibold text-white md:text-neutral-900">
                          {metric.value}
                        </dd>
                        {(metric.change || metric.trend) && (
                          <p className="text-[0.7rem] uppercase tracking-wide text-white/60 md:text-neutral-500">
                            {metric.change ?? metric.trend}
                          </p>
                        )}
                      </div>
                    ))}
                  </dl>
                </article>
              )}
            </section>
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center text-sm text-white/70 md:border-neutral-200 md:bg-neutral-50 md:text-neutral-500">
              Select data in the table or apply filters to feed the assistant with context.
            </div>
          )}

          <section aria-label="Assistant actions" className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-atlas-blue">
              Quick actions
            </h3>
            {actions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/20 bg-white/5 px-4 py-3 text-xs text-white/70 md:border-neutral-200 md:bg-neutral-50 md:text-neutral-500">
                Screens can register assistant actions such as explaining a metric or drafting a
                filter. These will appear here automatically.
              </p>
            ) : (
              <div className="space-y-2">
                {actions.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => action.onSelect()}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm font-semibold text-white transition-all hover:border-white/25 hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-atlas-blue/50 focus:ring-offset-2 focus:ring-offset-transparent md:border-neutral-200 md:bg-white md:text-neutral-800 md:hover:bg-neutral-100"
                  >
                    <span>{action.label}</span>
                    {action.shortcut && (
                      <kbd className="rounded-md border border-white/30 bg-black/20 px-1.5 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide text-white/70 md:border-neutral-300 md:bg-white md:text-neutral-500">
                        {action.shortcut}
                      </kbd>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section aria-label="Assistant conversation" className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.3em] text-atlas-blue">
              Conversation
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-atlas-blue text-xs font-bold text-white">
                  AI
                </span>
                <p className="rounded-2xl bg-white/10 px-4 py-3 text-sm text-white/90 md:bg-neutral-100 md:text-neutral-800">
                  Hi! I can explain metrics, generate filters, or help you understand what you're
                  looking at. Select data to get started.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-transparent text-xs font-bold text-white">
                  You
                </span>
                <p className="rounded-2xl border border-dashed border-white/20 px-4 py-3 text-sm text-white/70 md:border-neutral-200 md:text-neutral-500">
                  Conversation history will appear here once Atlas assistant is connected to
                  generative AI.
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="mt-6 flex items-center justify-between text-[0.65rem] uppercase tracking-[0.2em] text-white/60 md:text-neutral-500">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Privacy controls follow page settings</span>
          </div>
          <span>Atlas beta</span>
        </footer>
      </aside>
    </>
  );
}

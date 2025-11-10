"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, UsersRound, FileWarning, ClipboardList, ShieldAlert } from "lucide-react";
import classNames from "classnames";
import { getSupabaseClient } from "@/lib/supabase-client";
import { runOmniSearch } from "@/lib/omnisearch/search";
import type { OmniSearchResult, OmniSearchCategory } from "@/lib/omnisearch/types";

const CATEGORY_LABELS: Record<OmniSearchCategory, string> = {
  agent: "Agents",
  request: "Requests",
  policy: "Policies",
  task: "Tasks",
};

const CATEGORY_ICONS: Record<OmniSearchCategory, JSX.Element> = {
  agent: <UsersRound className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />, 
  request: <FileWarning className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />, 
  policy: <ShieldAlert className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />,
  task: <ClipboardList className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />,
};

const categoryOrder: OmniSearchCategory[] = ["agent", "request", "policy", "task"];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (result: OmniSearchResult) => void;
}

interface GroupedResults {
  category: OmniSearchCategory;
  items: OmniSearchResult[];
}

function groupResults(results: OmniSearchResult[]): GroupedResults[] {
  const grouped: Partial<Record<OmniSearchCategory, OmniSearchResult[]>> = {};
  for (const result of results) {
    if (!grouped[result.category]) grouped[result.category] = [];
    grouped[result.category]!.push(result);
  }
  return categoryOrder
    .map((category) => ({ category, items: grouped[category] ?? [] }))
    .filter((group) => group.items.length > 0);
}

export function CommandPalette({ open, onOpenChange, onSelect }: CommandPaletteProps) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OmniSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [groups, setGroups] = useState<GroupedResults[]>([]);

  const flatResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setResults([]);
      setGroups([]);
      setError(null);
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (!supabase) {
      setError("Supabase client is not configured. Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
      setResults([]);
      setGroups([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const run = async () => {
      const trimmed = query.trim();
      if (!trimmed) {
        setResults([]);
        setGroups([]);
        setError(null);
        setLoading(false);
        setActiveIndex(0);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await runOmniSearch(supabase, trimmed);
        if (!controller.signal.aborted) {
          setResults(res);
          setGroups(groupResults(res));
          setActiveIndex(0);
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to run search");
          setResults([]);
          setGroups([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    const debounce = setTimeout(run, 150);
    return () => {
      controller.abort();
      clearTimeout(debounce);
    };
  }, [open, supabase, query]);

  useEffect(() => {
    setGroups(groupResults(results));
  }, [results]);

  const handleClose = () => onOpenChange(false);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      handleClose();
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => {
        if (flatResults.length === 0) return 0;
        return (prev + 1) % flatResults.length;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => {
        if (flatResults.length === 0) return 0;
        return (prev - 1 + flatResults.length) % flatResults.length;
      });
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selection = flatResults[activeIndex];
      if (selection) {
        onSelect(selection);
        handleClose();
      }
    }
  };

  const renderResult = (result: OmniSearchResult, index: number) => {
    const isActive = index === activeIndex;
    return (
      <button
        key={`${result.category}-${result.id}`}
        type="button"
        onClick={() => {
          onSelect(result);
          handleClose();
        }}
        className={classNames(
          "flex w-full flex-col gap-1 rounded-lg border border-transparent px-3 py-2 text-left transition",
          isActive
            ? "bg-[color:var(--color-accent)]/10 border-[color:var(--color-accent)]/40"
            : "hover:bg-[color:var(--color-surface)]/80",
        )}
        data-active={isActive || undefined}
      >
        <span className="text-sm font-semibold text-[color:var(--color-foreground)]">{result.title}</span>
        {result.subtitle && (
          <span className="text-xs text-[color:var(--color-muted)]">{result.subtitle}</span>
        )}
        {result.description && (
          <span className="text-xs text-[color:var(--color-muted)] line-clamp-2">{result.description}</span>
        )}
      </button>
    );
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-black/40 backdrop-blur-sm"
      role="presentation"
      onClick={handleClose}
    >
      <div
        className="mt-24 w-full max-w-2xl overflow-hidden rounded-2xl border border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)] shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Omnisearch command palette"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[color:var(--color-border)]/60 bg-[color:var(--color-surface)]/95 px-4 py-3">
          <Search className="h-4 w-4 text-[color:var(--color-muted)]" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search agents, requests, policies, and tasks"
            className="w-full border-none bg-transparent text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted)]"
            aria-label="Search command palette"
          />
          <kbd className="rounded border border-[color:var(--color-border)]/60 bg-white/60 px-2 py-1 text-[0.65rem] font-medium text-[color:var(--color-muted)]">
            Esc
          </kbd>
        </div>
        <div className="max-h-80 overflow-y-auto bg-[color:var(--color-surface)] px-3 py-3">
          {error && (
            <p className="rounded-lg bg-red-100 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {!error && loading && (
            <p className="px-3 py-2 text-sm text-[color:var(--color-muted)]">Searching…</p>
          )}
          {!error && !loading && flatResults.length === 0 && query.trim() && (
            <p className="px-3 py-2 text-sm text-[color:var(--color-muted)]">No results for “{query.trim()}”.</p>
          )}
          {!error && !loading && !query.trim() && (
            <p className="px-3 py-2 text-sm text-[color:var(--color-muted)]">
              Start typing to search agents, live requests, guardrail policies, and tasks.
            </p>
          )}
          {!error && groups.length > 0 && (
            <div className="space-y-4">
              {groups.map((group) => {
                const firstItem = group.items[0];
                const offsetIndex = firstItem
                  ? flatResults.findIndex(
                      (item) => item.id === firstItem.id && item.category === firstItem.category,
                    )
                  : 0;
                const offset = offsetIndex >= 0 ? offsetIndex : 0;
                return (
                  <section key={group.category} className="space-y-2">
                    <header className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                      {CATEGORY_ICONS[group.category]}
                      {CATEGORY_LABELS[group.category]}
                    </header>
                    <div className="grid gap-1">
                      {group.items.map((item, index) => renderResult(item, offset + index))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

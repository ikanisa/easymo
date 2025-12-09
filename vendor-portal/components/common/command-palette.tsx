"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Search, FileText, Users, Building, CreditCard, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { useFocusTrap } from "@/src/lib/a11y/useFocusTrap";

interface SearchResult {
  id: string;
  type: "page" | "group" | "member" | "sacco" | "payment";
  title: string;
  subtitle?: string;
  href: string;
  icon?: React.ReactNode;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

const QUICK_ACTIONS: SearchResult[] = [
  {
    id: "overview",
    type: "page",
    title: "Overview Dashboard",
    href: "/admin/overview",
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: "groups",
    type: "page",
    title: "Manage Groups",
    href: "/admin/groups",
    icon: <Users className="h-4 w-4" />,
  },
  {
    id: "saccos",
    type: "page",
    title: "Manage SACCOs",
    href: "/admin/saccos",
    icon: <Building className="h-4 w-4" />,
  },
  {
    id: "payments",
    type: "page",
    title: "Payment History",
    href: "/admin/payments",
    icon: <CreditCard className="h-4 w-4" />,
  },
];

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>(QUICK_ACTIONS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debouncedQuery = useDebouncedValue(query, 200);
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Search logic
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults(QUICK_ACTIONS);
      setSelectedIndex(0);
      return;
    }

    const filtered = QUICK_ACTIONS.filter(
      (item) =>
        item.title.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
        item.subtitle?.toLowerCase().includes(debouncedQuery.toLowerCase())
    );

    setResults(filtered);
    setSelectedIndex(0);
  }, [debouncedQuery]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % results.length);
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
          break;
        case "Enter":
          e.preventDefault();
          if (results[selectedIndex]) {
            router.push(results[selectedIndex].href);
            handleClose();
          }
          break;
      }
    },
    [results, selectedIndex, router]
  );

  const handleClose = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    onClose();
  }, [onClose]);

  useFocusTrap(isOpen, dialogRef, {
    onEscape: () => handleClose(),
    initialFocus: () => inputRef.current,
  });

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      router.push(result.href);
      handleClose();
    },
    [router, handleClose]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className="fixed inset-x-4 top-[20vh] z-50 mx-auto max-w-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Search and navigate"
        tabIndex={-1}
      >
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-800">
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-neutral-200 px-4 dark:border-neutral-700">
            <Search className="h-5 w-5 text-neutral-500 dark:text-neutral-400" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, groups, members..."
              className="flex-1 border-0 bg-transparent py-4 text-base outline-none placeholder:text-neutral-500 dark:text-neutral-100 dark:placeholder:text-neutral-400"
              aria-label="Search"
              aria-autocomplete="list"
              aria-controls="search-results"
              aria-activedescendant={results[selectedIndex]?.id}
            />
            <kbd className="hidden rounded bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600 sm:inline-block dark:bg-neutral-700 dark:text-neutral-300">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            id="search-results"
            role="listbox"
            className="max-h-[60vh] overflow-y-auto"
            aria-label="Search results"
          >
            {results.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500 dark:text-neutral-400">
                No results found for "{query}"
              </div>
            ) : (
              <>
                {/* Section Headers */}
                {query.trim() === "" && (
                  <div className="border-b border-neutral-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                    Quick Actions
                  </div>
                )}

                {/* Result Items */}
                <div className="py-2">
                  {results.map((result, index) => (
                    <button
                      key={result.id}
                      id={result.id}
                      role="option"
                      aria-selected={index === selectedIndex}
                      onClick={() => handleSelectResult(result)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                        index === selectedIndex
                          ? "bg-atlas-blue/10 text-atlas-blue-dark dark:bg-atlas-blue/20 dark:text-atlas-blue"
                          : "text-neutral-900 hover:bg-neutral-100 dark:text-neutral-100 dark:hover:bg-neutral-700"
                      )}
                    >
                      {result.icon && (
                        <div
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg",
                            index === selectedIndex
                              ? "bg-atlas-blue/20 text-atlas-blue-dark dark:bg-atlas-blue/30 dark:text-atlas-blue"
                              : "bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-400"
                          )}
                        >
                          {result.icon}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-sm text-neutral-600 truncate dark:text-neutral-400">
                            {result.subtitle}
                          </div>
                        )}
                      </div>
                      <ArrowRight
                        className={cn(
                          "h-4 w-4",
                          index === selectedIndex ? "opacity-100" : "opacity-0"
                        )}
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-3 text-xs text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
            <div className="flex gap-4">
              <div className="flex items-center gap-1">
                <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-700">
                  ↑
                </kbd>
                <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-700">
                  ↓
                </kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono dark:bg-neutral-700">
                  ↵
                </kbd>
                <span>Select</span>
              </div>
            </div>
            <div>
              <span className="sr-only">Found </span>
              {results.length} {results.length === 1 ? "result" : "results"}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Command } from "lucide-react";
import { VirtualTable } from "@/components/datagrid/virtual-table";
import { StatusChip } from "@/components/common/status-chip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePersistentState } from "@/lib/hooks/usePersistentState";
import { useAtlasAssistant } from "@/providers/atlas-assistant-provider";
import type { Database } from "@/lib/supabase/types";

export type MemberDirectoryRow = Pick<
  Database["public"]["Views"]["ikimina_members_public"]["Row"],
  | "id"
  | "full_name"
  | "member_code"
  | "msisdn"
  | "status"
  | "joined_at"
  | "ikimina_id"
  | "ikimina_name"
>;

interface AdminMembersDirectoryProps {
  rows: MemberDirectoryRow[];
}

type FilterState = {
  search: string;
  status: string | null;
  group: string | null;
  sort: "joined_desc" | "joined_asc";
};

type SavedView = {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
};

const STATUS_OPTIONS: Array<{
  value: string | null;
  label: string;
  tone: "success" | "warning" | "neutral";
}> = [
  { value: null, label: "All", tone: "neutral" },
  { value: "ACTIVE", label: "Active", tone: "success" },
  { value: "INACTIVE", label: "Inactive", tone: "neutral" },
  { value: "SUSPENDED", label: "Suspended", tone: "warning" },
];

const SORT_OPTIONS: ReadonlyArray<{ value: FilterState["sort"]; label: string }> = [
  { value: "joined_desc", label: "Newest first" },
  { value: "joined_asc", label: "Oldest first" },
];

const DEFAULT_FILTERS: FilterState = {
  search: "",
  status: null,
  group: null,
  sort: "joined_desc",
};

const STORAGE_KEY = "atlas.members.directory.savedViews.v1";

const dateFormatter = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "medium",
});

interface CommandDefinition {
  id: string;
  label: string;
  description?: string;
  action: () => void;
  shortcut?: string;
}

export function AdminMembersDirectory({ rows }: AdminMembersDirectoryProps) {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [savedViews, setSavedViews] = usePersistentState<SavedView[]>(STORAGE_KEY, []);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [viewName, setViewName] = useState("");
  const [viewsMenuOpen, setViewsMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { setContext } = useAtlasAssistant();

  const deferredSearch = useDeferredValue(filters.search);

  const groupOptions = useMemo(() => {
    return Array.from(
      new Set(
        rows.map((row) => row.ikimina_name).filter((value): value is string => Boolean(value))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    const base = rows.filter((row) => {
      if (filters.status && row.status !== filters.status) {
        return false;
      }
      if (filters.group && row.ikimina_name !== filters.group) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      const haystack =
        `${row.full_name ?? ""} ${row.member_code ?? ""} ${row.msisdn ?? ""} ${row.ikimina_name ?? ""}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    const sorted = [...base].sort((a, b) => {
      if (filters.sort === "joined_asc") {
        return compareByJoined(a, b);
      }
      return compareByJoined(b, a);
    });

    return sorted;
  }, [rows, filters.status, filters.group, filters.sort, deferredSearch]);

  const totalCount = rows.length;
  const visibleCount = filteredRows.length;

  useEffect(() => {
    setContext({
      title: "Member directory",
      subtitle: `${visibleCount} of ${totalCount} members visible`,
      metadata: {
        Status: filters.status ?? "All",
        Group: filters.group ?? "All",
        Search: filters.search || "—",
        Sort: SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ?? "Newest first",
      },
    });
  }, [filters, visibleCount, totalCount, setContext]);

  useEffect(() => () => setContext(null), [setContext]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const columns = useMemo<ColumnDef<MemberDirectoryRow, unknown>[]>(
    () => [
      {
        accessorKey: "full_name",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">Member</span>
        ),
        cell: ({ row }) => (
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-neutral-0">{row.original.full_name ?? "—"}</span>
            <span className="text-xs text-neutral-2">
              {row.original.member_code ?? "No member code"}
            </span>
          </div>
        ),
        meta: { template: "minmax(220px, 2.2fr)" },
      },
      {
        accessorKey: "ikimina_name",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">Group</span>
        ),
        cell: ({ getValue }) => (
          <span className="text-neutral-0">{(getValue() as string) ?? "—"}</span>
        ),
        meta: { template: "minmax(180px, 1.4fr)" },
      },
      {
        accessorKey: "msisdn",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">MSISDN</span>
        ),
        meta: { template: "minmax(150px, 1fr)", cellClassName: "font-mono text-xs text-neutral-2" },
      },
      {
        accessorKey: "joined_at",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">Joined</span>
        ),
        cell: ({ getValue }) => {
          const value = getValue() as string | null;
          if (!value) return "—";
          return dateFormatter.format(new Date(value));
        },
        meta: { template: "minmax(160px, 1fr)" },
      },
      {
        accessorKey: "status",
        header: () => (
          <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">Status</span>
        ),
        cell: ({ getValue }) => {
          const value = (getValue() as string | null) ?? "UNKNOWN";
          const tone =
            value === "ACTIVE" ? "success" : value === "SUSPENDED" ? "warning" : "neutral";
          return <StatusChip tone={tone}>{value}</StatusChip>;
        },
        meta: { template: "minmax(140px, 0.8fr)" },
      },
    ],
    []
  );

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const applySavedView = useCallback((view: SavedView) => {
    setFilters({ ...view.filters });
    setViewsMenuOpen(false);
    setPaletteOpen(false);
  }, []);

  const removeSavedView = useCallback(
    (id: string) => {
      setSavedViews((existing) => existing.filter((view) => view.id !== id));
    },
    [setSavedViews]
  );

  const handleSaveView = useCallback(() => {
    const trimmed = viewName.trim();
    if (!trimmed) {
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}`;
    const nextView: SavedView = {
      id,
      name: trimmed,
      filters,
      createdAt: new Date().toISOString(),
    };
    setSavedViews((existing) => {
      const existingIndex = existing.findIndex(
        (view) => view.name.toLowerCase() === trimmed.toLowerCase()
      );
      if (existingIndex >= 0) {
        const clone = [...existing];
        clone[existingIndex] = nextView;
        return clone;
      }
      return [...existing, nextView];
    });
    setViewName("");
    setIsSaveDialogOpen(false);
  }, [filters, setSavedViews, viewName]);

  const commands = useMemo<CommandDefinition[]>(() => {
    const items: CommandDefinition[] = [
      {
        id: "focus-search",
        label: "Focus member search",
        description: "Jump to the search input",
        action: () => {
          focusSearch();
          setPaletteOpen(false);
        },
        shortcut: "⌘K",
      },
      {
        id: "clear-filters",
        label: "Reset filters",
        description: "Clear search, status, and group filters",
        action: () => {
          resetFilters();
          setPaletteOpen(false);
        },
      },
      {
        id: "save-view",
        label: "Save current view",
        description: "Store filters for quick reuse",
        action: () => {
          setPaletteOpen(false);
          setIsSaveDialogOpen(true);
        },
      },
    ];

    STATUS_OPTIONS.filter((option) => option.value).forEach((option) => {
      items.push({
        id: `status-${option.value}`,
        label: `Filter status: ${option.label}`,
        action: () => {
          setFilters((current) => ({ ...current, status: option.value }));
          setPaletteOpen(false);
        },
      });
    });

    if (savedViews.length > 0) {
      savedViews.forEach((view) => {
        items.push({
          id: `view-${view.id}`,
          label: `Apply saved view: ${view.name}`,
          action: () => applySavedView(view),
        });
      });
    }

    return items;
  }, [focusSearch, resetFilters, savedViews, applySavedView]);

  return (
    <div className="space-y-6">
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        groupOptions={groupOptions}
        totalCount={totalCount}
        visibleCount={visibleCount}
        onReset={resetFilters}
        onSaveView={() => setIsSaveDialogOpen(true)}
        searchInputRef={searchInputRef}
        savedViews={savedViews}
        onApplySavedView={applySavedView}
        onRemoveSavedView={removeSavedView}
        viewsMenuOpen={viewsMenuOpen}
        setViewsMenuOpen={setViewsMenuOpen}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      <VirtualTable
        data={filteredRows}
        columns={columns}
        tableHeight={560}
        emptyState={
          <div className="text-center text-sm text-neutral-2">
            No members match the selected filters.
          </div>
        }
      />

      {isSaveDialogOpen && (
        <SaveViewDialog
          onClose={() => {
            setIsSaveDialogOpen(false);
            setViewName("");
          }}
          onSave={handleSaveView}
          value={viewName}
          onChange={setViewName}
          filters={filters}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
    </div>
  );
}

function compareByJoined(a: MemberDirectoryRow, b: MemberDirectoryRow) {
  const first = a.joined_at ? new Date(a.joined_at).getTime() : 0;
  const second = b.joined_at ? new Date(b.joined_at).getTime() : 0;
  return first - second;
}

interface FilterBarProps {
  filters: FilterState;
  onFiltersChange: (next: FilterState | ((current: FilterState) => FilterState)) => void;
  groupOptions: string[];
  totalCount: number;
  visibleCount: number;
  onReset: () => void;
  onSaveView: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
  savedViews: SavedView[];
  onApplySavedView: (view: SavedView) => void;
  onRemoveSavedView: (id: string) => void;
  viewsMenuOpen: boolean;
  setViewsMenuOpen: (value: boolean) => void;
  onOpenPalette: () => void;
}

function FilterBar({
  filters,
  onFiltersChange,
  groupOptions,
  totalCount,
  visibleCount,
  onReset,
  onSaveView,
  searchInputRef,
  savedViews,
  onApplySavedView,
  onRemoveSavedView,
  viewsMenuOpen,
  setViewsMenuOpen,
  onOpenPalette,
}: FilterBarProps) {
  const toggleStatus = (value: string | null) => {
    onFiltersChange((current) => ({
      ...current,
      status: current.status === value ? null : value,
    }));
  };

  const updateSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    onFiltersChange((current) => ({ ...current, search: next }));
  };

  const updateGroup = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value;
    onFiltersChange((current) => ({ ...current, group: next || null }));
  };

  const updateSort = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as FilterState["sort"];
    onFiltersChange((current) => ({ ...current, sort: next }));
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/5 backdrop-blur">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-col gap-3">
          <label className="flex flex-col gap-2 text-sm text-neutral-0">
            <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">
              Search members
            </span>
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Name, code, or MSISDN"
              value={filters.search}
              onChange={updateSearch}
              className="w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 placeholder:text-neutral-3 focus:outline-none focus:ring-2 focus:ring-atlas-blue"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => {
              const active = filters.status === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => toggleStatus(option.value)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition",
                    active
                      ? "bg-atlas-blue text-white shadow-atlas"
                      : "bg-white/5 text-neutral-2 hover:bg-white/10"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-2 text-sm text-neutral-0">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">Group</span>
              <select
                value={filters.group ?? ""}
                onChange={updateGroup}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-atlas-blue"
              >
                <option value="">All groups</option>
                {groupOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm text-neutral-0">
              <span className="text-xs uppercase tracking-[0.3em] text-neutral-2">Sort by</span>
              <select
                value={filters.sort}
                onChange={updateSort}
                className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-neutral-0 focus:outline-none focus:ring-2 focus:ring-atlas-blue"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReset}
              className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-0 transition hover:bg-white/10"
            >
              Reset filters
            </button>
            <button
              type="button"
              onClick={onSaveView}
              className="rounded-xl bg-atlas-blue px-3 py-2 text-sm font-semibold text-white shadow-atlas transition hover:bg-atlas-blue-dark"
            >
              Save view
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setViewsMenuOpen(!viewsMenuOpen)}
                aria-expanded={viewsMenuOpen}
                className="rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-0 transition hover:bg-white/10"
              >
                Saved views ({savedViews.length})
              </button>
              {viewsMenuOpen && (
                <div className="absolute right-0 top-12 z-20 min-w-[240px] rounded-2xl border border-white/10 bg-neutral-950/95 p-3 text-sm shadow-2xl">
                  {savedViews.length === 0 ? (
                    <p className="text-neutral-3">No saved views yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {savedViews.map((view) => (
                        <li key={view.id} className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => onApplySavedView(view)}
                            className="flex-1 text-left text-neutral-0 transition hover:text-white"
                          >
                            {view.name}
                          </button>
                          <button
                            type="button"
                            onClick={() => onRemoveSavedView(view.id)}
                            className="rounded-lg bg-white/5 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-neutral-3 transition hover:bg-white/10 hover:text-white"
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenPalette}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm text-neutral-0 transition hover:bg-white/10"
              aria-label="Open command palette"
            >
              <Command className="h-4 w-4" />
              Command palette
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-neutral-2">
        <span>
          Showing {visibleCount.toLocaleString()} of {totalCount.toLocaleString()} members
        </span>
        {filters.status && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-neutral-0">
            Status: {filters.status}
          </span>
        )}
        {filters.group && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-neutral-0">
            Group: {filters.group}
          </span>
        )}
        {filters.search && (
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.25em] text-neutral-0">
            Search: “{filters.search}”
          </span>
        )}
      </div>
    </div>
  );
}

interface SaveViewDialogProps {
  onClose: () => void;
  onSave: () => void;
  value: string;
  onChange: (value: string) => void;
  filters: FilterState;
}

function SaveViewDialog({ onClose, onSave, value, onChange, filters }: SaveViewDialogProps) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950/95 p-6 text-neutral-0 shadow-2xl">
        <h2 className="text-xl font-semibold">Save current view</h2>
        <p className="mt-2 text-sm text-neutral-2">
          Saved views capture search, status, group, and sort preferences so you can recall them
          from the command palette.
        </p>
        <div className="mt-4">
          <Input
            autoFocus
            label="View name"
            placeholder="e.g. Kigali actives"
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-neutral-2">
          <p className="font-semibold text-neutral-0">Filters summary</p>
          <ul className="mt-2 space-y-1">
            <li>Status: {filters.status ?? "All"}</li>
            <li>Group: {filters.group ?? "All"}</li>
            <li>Search: {filters.search || "—"}</li>
            <li>
              Sort:{" "}
              {SORT_OPTIONS.find((option) => option.value === filters.sort)?.label ??
                "Newest first"}
            </li>
          </ul>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-0 transition hover:bg-white/10"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            className="rounded-xl bg-atlas-blue px-4 py-2 text-sm font-semibold text-white shadow-atlas transition hover:bg-atlas-blue-dark"
          >
            Save view
          </button>
        </div>
      </div>
    </div>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: CommandDefinition[];
}

function CommandPalette({ open, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const filtered = useMemo(() => {
    if (!query) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(query.toLowerCase()));
  }, [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    const firstFocusable = containerRef.current?.querySelector<HTMLInputElement>("input");
    firstFocusable?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 px-4 py-24">
      <div
        ref={containerRef}
        className="w-full max-w-xl rounded-3xl border border-white/10 bg-neutral-950/95 p-6 text-neutral-0 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Member directory command palette"
      >
        <Input
          label="Command"
          placeholder="Type a command or view name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-sm text-neutral-3">No matching commands.</p>
          ) : (
            filtered.map((command) => (
              <button
                key={command.id}
                type="button"
                onClick={() => {
                  command.action();
                  onClose();
                }}
                className="flex w-full items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-left text-sm text-neutral-0 transition hover:border-atlas-blue/50 hover:bg-atlas-blue/10 hover:text-white"
              >
                <span>
                  <span className="block font-medium">{command.label}</span>
                  {command.description && (
                    <span className="text-xs text-neutral-3">{command.description}</span>
                  )}
                </span>
                {command.shortcut && (
                  <span className="text-[11px] uppercase tracking-[0.25em] text-neutral-3">
                    {command.shortcut}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-neutral-0 transition hover:bg-white/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

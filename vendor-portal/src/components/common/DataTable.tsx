"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnOrderState,
  type ColumnPinningState,
  type ColumnVisibilityState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Menu, Transition } from "@headlessui/react";
import {
  Check,
  ChevronDown,
  Columns2,
  CopyPlus,
  ListFilter,
  Loader2,
  MoreHorizontal,
  Rows4,
  Save,
  Star,
  StarOff,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useProfileContext } from "@/providers/profile-provider";
import {
  type SavedViewConfig,
  type SavedViewRecord,
  type TableDensity,
  useSavedViews,
} from "@/src/lib/views/saved-views";

export interface BulkAction<TData> {
  id: string;
  label: string;
  onAction: (rows: TData[]) => void;
  icon?: React.ReactNode;
  tone?: "default" | "danger";
  description?: string;
}

interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  className?: string;
  tableHeight?: number;
  filterBar?: React.ReactNode;
  filtersState?: Record<string, unknown>;
  onFiltersStateChange?: (next: Record<string, unknown>) => void;
  enableRowSelection?: boolean;
  onRowSelectionChange?: (rows: TData[]) => void;
  bulkActions?: BulkAction<TData>[];
  viewScope?: string;
  loading?: boolean;
  error?: React.ReactNode;
  empty?: React.ReactNode;
  skeleton?: React.ReactNode;
  initialDensity?: TableDensity;
  getRowId?: (row: TData, index: number) => string;
  virtualizationThreshold?: number;
  disableVirtualization?: boolean;
}

type ColumnMeta = {
  align?: "left" | "right" | "center";
  headerClassName?: string;
  cellClassName?: string;
  pinned?: "left" | "right";
};

type DensityDefinition = {
  id: TableDensity;
  label: string;
  height: number;
};

const DENSITY_OPTIONS: DensityDefinition[] = [
  { id: "compact", label: "Compact", height: 44 },
  { id: "cozy", label: "Cozy", height: 56 },
  { id: "comfortable", label: "Comfortable", height: 68 },
];

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia(query);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener("change", listener);
    setMatches(media.matches);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

function getDensityMeta(density: TableDensity | undefined) {
  return DENSITY_OPTIONS.find((option) => option.id === density) ?? DENSITY_OPTIONS[1];
}

function createInitialPinning(columns: ColumnDef<any, unknown>[]): ColumnPinningState {
  const left: string[] = [];
  const right: string[] = [];
  columns.forEach((column) => {
    const meta = column.meta as ColumnMeta | undefined;
    const id = (column.id ?? column.accessorKey ?? "") as string;
    if (!id) return;
    if (meta?.pinned === "left") left.push(id);
    if (meta?.pinned === "right") right.push(id);
  });
  return { left, right } satisfies ColumnPinningState;
}

function createInitialVisibility(columns: ColumnDef<any, unknown>[]): ColumnVisibilityState {
  const visibility: ColumnVisibilityState = {};
  columns.forEach((column) => {
    const id = (column.id ?? column.accessorKey ?? "") as string;
    if (!id) return;
    if (column.enableHiding === false) {
      visibility[id] = true;
    }
  });
  return visibility;
}

function SelectionCheckbox({
  checked,
  indeterminate,
  onChange,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = Boolean(indeterminate) && !checked;
    }
  }, [checked, indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={ariaLabel}
      className="h-4 w-4 rounded border-white/20 bg-transparent accent-white"
      checked={checked}
      onChange={onChange}
    />
  );
}

export function DataTable<TData>({
  data,
  columns,
  className,
  tableHeight = 480,
  filterBar,
  filtersState,
  onFiltersStateChange,
  enableRowSelection = true,
  onRowSelectionChange,
  bulkActions,
  viewScope,
  loading = false,
  error,
  empty,
  skeleton,
  initialDensity = "cozy",
  getRowId,
  virtualizationThreshold = 40,
  disableVirtualization = false,
}: DataTableProps<TData>) {
  const { profile } = useProfileContext();
  const densityMeta = getDensityMeta(initialDensity);

  const [density, setDensity] = useState<TableDensity>(densityMeta.id);
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityState>(() =>
    createInitialVisibility(columns)
  );
  const [columnPinning, setColumnPinning] = useState<ColumnPinningState>(() =>
    createInitialPinning(columns)
  );
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([]);
  const [sorting, setSorting] = useState<SortingState>([]);

  const resolvedColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enableRowSelection) return columns;

    const selectionColumn: ColumnDef<TData, unknown> = {
      id: "__selection",
      enablePinning: true,
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <SelectionCheckbox
            aria-label="Select all rows"
            checked={table.getIsAllRowsSelected()}
            indeterminate={table.getIsSomeRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler() as any}
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <SelectionCheckbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            indeterminate={false}
            onChange={row.getToggleSelectedHandler() as any}
          />
        </div>
      ),
      size: 48,
      minSize: 48,
      maxSize: 48,
      meta: { pinned: "left", align: "center" } satisfies ColumnMeta,
    };

    return [selectionColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable<TData>({
    data,
    columns: resolvedColumns,
    state: {
      rowSelection,
      columnVisibility,
      columnPinning,
      columnOrder,
      sorting,
    },
    initialState: {
      columnPinning,
      columnVisibility,
      columnOrder,
      sorting,
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnPinningChange: setColumnPinning,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    getRowId,
  });

  useEffect(() => {
    onRowSelectionChange?.(table.getSelectedRowModel().rows.map((row) => row.original));
  }, [onRowSelectionChange, table]);

  const isMobile = useMediaQuery("(max-width: 640px)");
  const densityDefinition = getDensityMeta(density);
  const rowHeight = densityDefinition.height;

  const virtualizationEnabled = useMemo(
    () =>
      !disableVirtualization &&
      !isMobile &&
      table.getRowModel().rows.length > virtualizationThreshold,
    [disableVirtualization, isMobile, table, virtualizationThreshold]
  );

  const containerRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: virtualizationEnabled ? table.getRowModel().rows.length : 0,
    getScrollElement: () => containerRef.current,
    estimateSize: () => rowHeight,
    overscan: 8,
  });

  const virtualItems = virtualizationEnabled ? virtualizer.getVirtualItems() : [];
  const totalSize = virtualizationEnabled ? virtualizer.getTotalSize() : 0;

  const gridTemplate = useMemo(() => {
    const template = table
      .getVisibleLeafColumns()
      .map((column) => `${column.getSize()}px`)
      .join(" ");
    return template.length > 0 ? template : "repeat(auto-fit, minmax(160px, 1fr))";
    // columnOrder, columnPinning, columnVisibility are intentionally omitted - table already includes them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table]);

  const leftOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let offset = 0;
    table.getLeftLeafColumns().forEach((column) => {
      offsets.set(column.id, offset);
      offset += column.getSize();
    });
    return offsets;
  }, [table]);

  const rightOffsets = useMemo(() => {
    const offsets = new Map<string, number>();
    let offset = 0;
    const columns = table.getRightLeafColumns();
    for (let index = columns.length - 1; index >= 0; index -= 1) {
      const column = columns[index];
      offsets.set(column.id, offset);
      offset += column.getSize();
    }
    return offsets;
  }, [table]);

  const applyView = useCallback(
    (config: SavedViewConfig) => {
      setColumnVisibility((prev) => ({ ...prev, ...(config.columnVisibility ?? {}) }));
      if (config.columnPinning) setColumnPinning(config.columnPinning);
      if (config.columnOrder) setColumnOrder(config.columnOrder);
      if (config.sorting) setSorting(config.sorting);
      if (config.density) setDensity(config.density);
      if (config.filters && onFiltersStateChange) {
        onFiltersStateChange(config.filters);
      }
    },
    [onFiltersStateChange]
  );

  const {
    views,
    applyView: triggerApplyView,
    saveView,
    deleteView,
    setDefaultView,
    activeViewId,
    setActiveViewId,
  } = useSavedViews({
    scope: viewScope,
    userId: profile?.id,
    role: profile?.role ?? null,
    onApply: (config) => applyView(config),
  });

  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original);

  const handleSaveView = useCallback(
    async (view?: SavedViewRecord | null) => {
      if (!viewScope) return;
      const name = window.prompt("Name this view", view?.name ?? "")?.trim();
      if (!name) return;
      const config: SavedViewConfig = {
        columnVisibility,
        columnPinning,
        columnOrder,
        sorting,
        density,
        filters: filtersState ?? {},
      };
      const next = await saveView({
        name,
        config,
        makeDefault: view?.is_default ?? false,
        viewId: view?.id,
      });
      if (next) {
        setActiveViewId(next.id);
      }
    },
    [
      columnOrder,
      columnPinning,
      columnVisibility,
      density,
      filtersState,
      saveView,
      setActiveViewId,
      sorting,
      viewScope,
    ]
  );

  const handleSetDefault = useCallback(
    async (viewId: string) => {
      await setDefaultView(viewId);
      setActiveViewId(viewId);
    },
    [setActiveViewId, setDefaultView]
  );

  const savedViewMenu = useMemo(() => {
    if (!viewScope) return null;
    return (
      <Menu as="div" className="relative">
        <Menu.Button className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-0 shadow-sm transition hover:border-white/20 hover:bg-white/10">
          <ListFilter className="h-4 w-4" />
          <span>
            {activeViewId
              ? (views.find((view) => view.id === activeViewId)?.name ?? "Custom")
              : "Default view"}
          </span>
          <ChevronDown className="h-4 w-4" />
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="absolute right-0 z-20 mt-2 w-64 origin-top-right rounded-xl border border-white/10 bg-[#0f1426] p-2 shadow-2xl focus:outline-none">
            <div className="px-2 py-1 text-xs uppercase tracking-[0.3em] text-neutral-2">
              Saved views
            </div>
            <Menu.Item>
              {({ active }) => (
                <button
                  type="button"
                  onClick={() => handleSaveView(null)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                    active ? "bg-white/10 text-neutral-0" : "text-neutral-1"
                  )}
                >
                  <CopyPlus className="h-4 w-4" />
                  Create view from current
                </button>
              )}
            </Menu.Item>
            <div className="my-2 h-px bg-white/5" />
            {views.length === 0 ? (
              <p className="px-3 py-2 text-xs text-neutral-2">No saved views yet.</p>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className="mb-1 overflow-hidden rounded-lg border border-white/5"
                >
                  <div className="flex items-center justify-between bg-white/5 px-3 py-2 text-xs font-semibold text-neutral-0">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 text-left"
                      onClick={() => {
                        setActiveViewId(view.id);
                        triggerApplyView(view.id);
                      }}
                    >
                      {view.is_default ? (
                        <Star className="h-3.5 w-3.5" />
                      ) : (
                        <Rows4 className="h-3.5 w-3.5" />
                      )}
                      <span className="truncate text-sm font-medium">{view.name}</span>
                    </button>
                    <Menu as="div" className="relative">
                      <Menu.Button className="rounded-full p-1 text-neutral-2 hover:bg-white/10 hover:text-neutral-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Menu.Button>
                      <Transition
                        as={Fragment}
                        enter="transition ease-out duration-100"
                        enterFrom="transform opacity-0 scale-95"
                        enterTo="transform opacity-100 scale-100"
                        leave="transition ease-in duration-75"
                        leaveFrom="transform opacity-100 scale-100"
                        leaveTo="transform opacity-0 scale-95"
                      >
                        <Menu.Items className="absolute right-0 z-30 mt-2 w-48 origin-top-right rounded-xl border border-white/10 bg-[#0f1426] p-1 text-sm shadow-xl focus:outline-none">
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                type="button"
                                onClick={() => handleSaveView(view)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-lg px-3 py-2",
                                  active ? "bg-white/10 text-neutral-0" : "text-neutral-1"
                                )}
                              >
                                <Save className="h-4 w-4" /> Update view
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                type="button"
                                onClick={() => handleSetDefault(view.id)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-lg px-3 py-2",
                                  active ? "bg-white/10 text-neutral-0" : "text-neutral-1"
                                )}
                              >
                                {view.is_default ? (
                                  <StarOff className="h-4 w-4" />
                                ) : (
                                  <Star className="h-4 w-4" />
                                )}
                                {view.is_default ? "Unset default" : "Make default"}
                              </button>
                            )}
                          </Menu.Item>
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                type="button"
                                onClick={() => deleteView(view.id)}
                                className={cn(
                                  "flex w-full items-center gap-2 rounded-lg px-3 py-2",
                                  active ? "bg-red-500/20 text-red-200" : "text-red-300"
                                )}
                              >
                                <Trash2 className="h-4 w-4" /> Delete
                              </button>
                            )}
                          </Menu.Item>
                        </Menu.Items>
                      </Transition>
                    </Menu>
                  </div>
                  {view.role && (
                    <div className="bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-neutral-2">
                      {view.role}
                    </div>
                  )}
                </div>
              ))
            )}
          </Menu.Items>
        </Transition>
      </Menu>
    );
  }, [
    activeViewId,
    deleteView,
    handleSaveView,
    handleSetDefault,
    setActiveViewId,
    triggerApplyView,
    viewScope,
    views,
  ]);

  const columnManager = (
    <Menu as="div" className="relative">
      <Menu.Button className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-0 hover:border-white/20 hover:bg-white/10">
        <Columns2 className="h-4 w-4" />
        Columns
        <ChevronDown className="h-4 w-4" />
      </Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-20 mt-2 max-h-72 w-56 origin-top-right overflow-y-auto rounded-xl border border-white/10 bg-[#0f1426] p-2 text-sm shadow-2xl focus:outline-none">
          {table.getAllLeafColumns().map((column) => {
            if (!column.getCanHide()) return null;
            return (
              <Menu.Item key={column.id}>
                {({ active }) => (
                  <button
                    type="button"
                    onClick={column.getToggleVisibilityHandler()}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition",
                      active ? "bg-white/10 text-neutral-0" : "text-neutral-1"
                    )}
                  >
                    <Check
                      className={cn(
                        "h-4 w-4",
                        column.getIsVisible() ? "text-emerald-300" : "text-white/30"
                      )}
                    />
                    {flexRender(column.columnDef.header, column.getContext())}
                  </button>
                )}
              </Menu.Item>
            );
          })}
        </Menu.Items>
      </Transition>
    </Menu>
  );

  const densitySelector = (
    <Menu as="div" className="relative">
      <Menu.Button className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-neutral-0 hover:border-white/20 hover:bg-white/10">
        <Rows4 className="h-4 w-4" />
        Density
        <ChevronDown className="h-4 w-4" />
      </Menu.Button>
      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 z-20 mt-2 w-48 origin-top-right rounded-xl border border-white/10 bg-[#0f1426] p-1 text-sm shadow-2xl focus:outline-none">
          {DENSITY_OPTIONS.map((option) => (
            <Menu.Item key={option.id}>
              {({ active }) => (
                <button
                  type="button"
                  onClick={() => setDensity(option.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2",
                    active ? "bg-white/10 text-neutral-0" : "text-neutral-1"
                  )}
                >
                  <span>{option.label}</span>
                  {option.id === density && <Check className="h-4 w-4" />}
                </button>
              )}
            </Menu.Item>
          ))}
        </Menu.Items>
      </Transition>
    </Menu>
  );

  let bodyContent: React.ReactNode = null;

  if (loading) {
    bodyContent = skeleton ?? (
      <div className="flex h-[320px] items-center justify-center text-neutral-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="ml-2 text-sm">Loading data…</span>
      </div>
    );
  } else if (error) {
    bodyContent = (
      <div className="flex h-[320px] items-center justify-center text-sm text-red-300">{error}</div>
    );
  } else if (table.getRowModel().rows.length === 0) {
    bodyContent = empty ?? (
      <div className="flex h-[320px] items-center justify-center text-sm text-neutral-2">
        No results
      </div>
    );
  } else if (virtualizationEnabled) {
    bodyContent = (
      <div
        ref={containerRef}
        className="relative max-h-full overflow-auto"
        style={{ height: tableHeight }}
      >
        <div style={{ height: totalSize, position: "relative" }}>
          {virtualItems.map((virtualRow) => {
            const row = table.getRowModel().rows[virtualRow.index];
            return (
              <div
                key={row.id}
                className="grid items-center border-b border-white/5 px-4 text-sm"
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  transform: `translateY(${virtualRow.start}px)`,
                  minHeight: rowHeight,
                  display: "grid",
                  gridTemplateColumns: gridTemplate,
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                  const pinned = cell.column.getIsPinned();
                  const offset =
                    pinned === "left"
                      ? (leftOffsets.get(cell.column.id) ?? 0)
                      : pinned === "right"
                        ? (rightOffsets.get(cell.column.id) ?? 0)
                        : 0;
                  const align =
                    meta?.align === "right"
                      ? "text-right"
                      : meta?.align === "center"
                        ? "text-center"
                        : "text-left";
                  return (
                    <div
                      key={cell.id}
                      className={cn(
                        "flex h-full items-center px-2",
                        align,
                        meta?.cellClassName,
                        pinned ? "sticky bg-[#0b1020]" : undefined,
                        pinned === "left" ? "z-10" : undefined,
                        pinned === "right" ? "z-10" : undefined
                      )}
                      style={{
                        minWidth: cell.column.getSize(),
                        width: cell.column.getSize(),
                        left: pinned === "left" ? offset : undefined,
                        right: pinned === "right" ? offset : undefined,
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  } else {
    bodyContent = (
      <div className="relative max-h-full overflow-x-auto">
        {table.getRowModel().rows.map((row) => (
          <div
            key={row.id}
            className="grid items-center border-b border-white/5 px-4 py-2 text-sm"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {row.getVisibleCells().map((cell) => {
              const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
              const pinned = cell.column.getIsPinned();
              const offset =
                pinned === "left"
                  ? (leftOffsets.get(cell.column.id) ?? 0)
                  : pinned === "right"
                    ? (rightOffsets.get(cell.column.id) ?? 0)
                    : 0;
              const align =
                meta?.align === "right"
                  ? "text-right"
                  : meta?.align === "center"
                    ? "text-center"
                    : "text-left";
              return (
                <div
                  key={cell.id}
                  className={cn(
                    "flex h-full items-center px-2",
                    align,
                    meta?.cellClassName,
                    pinned ? "sticky bg-[#0b1020]" : undefined,
                    pinned === "left" ? "z-10" : undefined,
                    pinned === "right" ? "z-10" : undefined
                  )}
                  style={{
                    minWidth: cell.column.getSize(),
                    width: cell.column.getSize(),
                    left: pinned === "left" ? offset : undefined,
                    right: pinned === "right" ? offset : undefined,
                  }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-1 flex-wrap items-center gap-2">{filterBar}</div>
        <div className="flex flex-wrap items-center gap-2">
          {savedViewMenu}
          {densitySelector}
          {columnManager}
        </div>
      </div>

      {bulkActions && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          <div className="font-medium">{selectedRows.length} selected</div>
          <div className="flex flex-wrap items-center gap-2">
            {bulkActions.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => action.onAction(selectedRows)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                  action.tone === "danger"
                    ? "border-red-500/50 bg-red-500/10 text-red-200 hover:border-red-400/80 hover:bg-red-500/20"
                    : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:border-emerald-400/70 hover:bg-emerald-500/20"
                )}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0b1020] text-sm text-neutral-0 shadow-2xl">
        <div className="sticky top-0 z-10 bg-white/5 px-4 py-3 text-xs uppercase tracking-[0.3em] text-neutral-2">
          <div className="grid items-center" style={{ gridTemplateColumns: gridTemplate }}>
            {table.getHeaderGroups().map((headerGroup) => (
              <Fragment key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  if (header.isPlaceholder) return null;
                  const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                  const pinned = header.column.getIsPinned();
                  const offset =
                    pinned === "left"
                      ? (leftOffsets.get(header.column.id) ?? 0)
                      : pinned === "right"
                        ? (rightOffsets.get(header.column.id) ?? 0)
                        : 0;
                  const align =
                    meta?.align === "right"
                      ? "text-right"
                      : meta?.align === "center"
                        ? "text-center"
                        : "text-left";
                  return (
                    <div
                      key={header.id}
                      className={cn(
                        "px-2 text-xs uppercase tracking-[0.3em] text-neutral-2",
                        align,
                        meta?.headerClassName,
                        pinned ? "sticky bg-[#0b1020]" : undefined,
                        pinned === "left" ? "z-20" : undefined,
                        pinned === "right" ? "z-20" : undefined
                      )}
                      style={{
                        minWidth: header.column.getSize(),
                        width: header.column.getSize(),
                        left: pinned === "left" ? offset : undefined,
                        right: pinned === "right" ? offset : undefined,
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
        {bodyContent}
      </div>
    </div>
  );
}

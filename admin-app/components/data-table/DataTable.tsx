"use client";

import { CSSProperties, useCallback, useId, useMemo, useRef, useState } from "react";
import {
  ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import Papa from "papaparse";
import classNames from "classnames";

import styles from '@/components/data-table/DataTable.module.css';
import { Button } from '@/components/ui/Button';

const DEFAULT_ROW_HEIGHT = 56;

type DataTableFilterOption = {
  label: string;
  value: string;
};

export type DataTableFilter<TData> =
  | {
      id: string;
      label: string;
      columnId: string;
      type: "select";
      options: DataTableFilterOption[];
      placeholder?: string;
    }
  | {
      id: string;
      label: string;
      columnId: string;
      type: "multi-select";
      options: DataTableFilterOption[];
    };

export type DataTableColumn<TData> = ColumnDef<TData, unknown>;

function getColumnIdentifier<TData>(column: DataTableColumn<TData>): string | undefined {
  if (typeof column.id === "string" && column.id) {
    return column.id;
  }
  if ("accessorKey" in column && typeof column.accessorKey === "string") {
    return column.accessorKey;
  }
  return undefined;
}

export interface DataTableProps<TData> {
  data: TData[];
  columns: DataTableColumn<TData>[];
  /** key used for the built-in global search input */
  globalFilterKey?: keyof TData & string;
  /** override filter function when a single key is insufficient */
  globalFilterFn?: (row: TData, filterValue: string) => boolean;
  searchPlaceholder?: string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  downloadFileName?: string;
  filters?: DataTableFilter<TData>[];
}

const selectFilterFn: FilterFn<unknown> = (row, columnId, filterValue) => {
  if (!filterValue) return true;
  const raw = row.getValue(columnId);
  if (raw == null) return false;
  return String(raw).toLowerCase() === String(filterValue).toLowerCase();
};

const multiSelectFilterFn: FilterFn<unknown> = (row, columnId, filterValue) => {
  if (!Array.isArray(filterValue) || filterValue.length === 0) {
    return true;
  }
  const raw = row.getValue(columnId);
  if (raw == null) return false;
  if (Array.isArray(raw)) {
    return raw.some((value) => filterValue.includes(String(value)));
  }
  return filterValue.includes(String(raw));
};

export function DataTable<TData>({
  data,
  columns,
  globalFilterKey,
  globalFilterFn,
  searchPlaceholder = "Search…",
  isLoading = false,
  emptyTitle = "No records",
  emptyDescription = "Try adjusting filters or search criteria.",
  downloadFileName = "export.csv",
  filters,
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const columnDefs = useMemo(() => columns, [columns]);
  const columnFilterMap = useMemo(() => {
    return new Map((filters ?? []).map((filter) => [filter.columnId, filter]));
  }, [filters]);
  const resolvedColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    return columnDefs.map((column) => {
      const identifier = getColumnIdentifier(column);
      if (!identifier) return column;
      const filter = columnFilterMap.get(identifier);
      if (!filter) return column;
      if (filter.type === "multi-select") {
        return {
          ...column,
          filterFn: (column.filterFn ?? "multiSelect") as ColumnDef<TData, unknown>["filterFn"],
        };
      }
      if (filter.type === "select") {
        return {
          ...column,
          filterFn: (column.filterFn ?? "select") as ColumnDef<TData, unknown>["filterFn"],
        };
      }
      return column;
    });
  }, [columnDefs, columnFilterMap]);
  const searchInputId = useId();
  const tableInstanceId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const table = useReactTable({
    data,
    columns: resolvedColumns,
    state: {
      globalFilter,
      columnFilters,
    },
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    globalFilterFn: globalFilterFn
      ? (row, _columnId, filterValue) =>
        globalFilterFn(row.original, String(filterValue))
      : globalFilterKey
      ? (row) => {
        const value = row.original[globalFilterKey];
        if (value == null) return false;
        return String(value).toLowerCase().includes(globalFilter.toLowerCase());
      }
      : undefined,
    filterFns: {
      select: selectFilterFn,
      multiSelect: multiSelectFilterFn,
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    estimateSize: () => DEFAULT_ROW_HEIGHT,
    getScrollElement: () => containerRef.current,
    overscan: 8,
  });

  const columnTemplate = useMemo(() => {
    return columnDefs
      .map((column) => {
        const width = (column.meta as { width?: string })?.width;
        return width ?? "minmax(160px, 1fr)";
      })
      .join(" ");
  }, [columnDefs]);

  const wrapperStyle = useMemo(
    () =>
      ({
        "--table-column-layout": columnTemplate,
      }) as CSSProperties,
    [columnTemplate],
  );

  const totalRows = table.getPreFilteredRowModel().rows.length;
  const filteredRows = table.getFilteredRowModel().rows.length;

  const activeFilterCount = useMemo(() => {
    let count = globalFilter.trim() ? 1 : 0;
    for (const filter of columnFilters) {
      if (Array.isArray(filter.value)) {
        if (filter.value.length > 0) count += 1;
      } else if (filter.value) {
        count += 1;
      }
    }
    return count;
  }, [columnFilters, globalFilter]);

  const handleReset = useCallback(() => {
    setGlobalFilter("");
    table.resetColumnFilters();
    setFiltersOpen(false);
  }, [table]);

  const handleSelectFilterChange = useCallback(
    (columnId: string, value: string) => {
      const column = table.getColumn(columnId);
      column?.setFilterValue(value || undefined);
    },
    [table],
  );

  const handleToggleMultiFilter = useCallback(
    (columnId: string, value: string) => {
      const column = table.getColumn(columnId);
      if (!column) return;
      const current = column.getFilterValue();
      const next = new Set<string>(Array.isArray(current) ? current : []);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      column.setFilterValue(Array.from(next));
    },
    [table],
  );

  const handleDownload = () => {
    const csv = Papa.unparse(
      table.getCoreRowModel().rows.map((row) =>
        row.original as Record<string, unknown>
      ),
    );
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", downloadFileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const renderedRows = table.getRowModel().rows;

  return (
    <div className={styles.wrapper} style={wrapperStyle} role="region" aria-live="polite">
      <div
        className={styles.toolbar}
        role="toolbar"
        aria-label="Table actions"
        id={`${tableInstanceId}-toolbar`}
      >
        <div className={styles.toolbarLeft}>
          {globalFilterKey || globalFilterFn ? (
            <>
              <label className={styles.searchLabel} htmlFor={searchInputId}>
                <span className="visually-hidden">Search table</span>
              </label>
              <input
                id={searchInputId}
                className={styles.searchInput}
                value={globalFilter}
                placeholder={searchPlaceholder}
                onChange={(event) => setGlobalFilter(event.target.value)}
                aria-controls={tableInstanceId}
              />
            </>
          ) : null}
          {filters?.length ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={styles.filterToggle}
              onClick={() => setFiltersOpen((value) => !value)}
            >
              Filters
              {activeFilterCount > 0 ? (
                <span
                  className={styles.filterBadge}
                  aria-label={`${activeFilterCount} active filters`}
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </Button>
          ) : null}
        </div>

        <div className={styles.toolbarRight}>
          <span className={styles.resultSummary}>
            Showing {filteredRows} of {totalRows}
          </span>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleReset}
            disabled={activeFilterCount === 0}
          >
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleDownload}
          >
            Export CSV
          </Button>
        </div>
      </div>

      {filtersOpen && filters?.length ? (
        <div className={styles.filterPanel} role="region" aria-label="Table filters">
          {filters.map((filter) => {
            const active = columnFilters.find((item) => item.id === filter.columnId)
              ?.value;
            if (filter.type === "select") {
              const value = typeof active === "string" ? active : "";
              return (
                <div key={filter.id} className={styles.filterGroup}>
                  <span className={styles.filterLabel}>{filter.label}</span>
                  <select
                    className={styles.filterSelect}
                    value={value}
                    onChange={(event) =>
                      handleSelectFilterChange(filter.columnId, event.target.value)
                    }
                    aria-label={filter.label}
                  >
                    <option value="">
                      {filter.placeholder ?? `All ${filter.label.toLowerCase()}`}
                    </option>
                    {filter.options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            const selected = Array.isArray(active)
              ? new Set(active)
              : new Set<string>();
            return (
              <fieldset key={filter.id} className={styles.filterGroup}>
                <legend className={styles.filterLabel}>{filter.label}</legend>
                <div className={styles.filterOptions}>
                  {filter.options.map((option) => {
                    const checked = selected.has(option.value);
                    return (
                      <label key={option.value} className={styles.filterOption}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            handleToggleMultiFilter(filter.columnId, option.value)
                          }
                        />
                        <span>{option.label}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>
      ) : null}

      <div
        className={styles.tableContainer}
        role="table"
        aria-busy={isLoading}
        aria-rowcount={renderedRows.length}
        aria-colcount={columnDefs.length}
        aria-describedby={`${tableInstanceId}-toolbar`}
        id={tableInstanceId}
      >
        <div role="rowgroup" className={styles.headerRow}>
          {table.getHeaderGroups().map((headerGroup) => (
            <div key={headerGroup.id} role="row" className={styles.row}>
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  role="columnheader"
                  className={classNames(styles.cell, styles.headerCell)}
                  style={{ width: header.getSize() }}
                >
                  {header.isPlaceholder ? null : flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          role="rowgroup"
          className={styles.body}
          ref={containerRef}
          aria-live="polite"
        >
          {isLoading
            ? (
              <div
                role="row"
                className={classNames(styles.row, styles.placeholderRow)}
              >
                <div role="cell" className={styles.cell}>
                  Loading…
                </div>
              </div>
            )
            : renderedRows.length === 0
            ? (
              <div
                role="row"
                className={classNames(styles.row, styles.placeholderRow)}
              >
                <div role="cell" className={styles.cell}>
                  <strong>{emptyTitle}</strong>
                  <p>{emptyDescription}</p>
                </div>
              </div>
            )
            : (
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = renderedRows[virtualRow.index];
                  if (!row) return null;
                  return (
                    <div
                      key={row.id}
                      role="row"
                      className={styles.row}
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <div
                          key={cell.id}
                          role="cell"
                          className={styles.cell}
                          style={{ width: cell.column.getSize() }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

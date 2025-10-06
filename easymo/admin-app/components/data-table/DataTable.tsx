"use client";

import { CSSProperties, useId, useMemo, useRef, useState } from "react";
import {
  ColumnDef,
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

export type DataTableColumn<TData> = ColumnDef<TData, unknown>;

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
}

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
}: DataTableProps<TData>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const columnDefs = useMemo(() => columns, [columns]);
  const searchInputId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  const table = useReactTable({
    data,
    columns: columnDefs,
    state: {
      globalFilter,
    },
    onGlobalFilterChange: setGlobalFilter,
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
        "--table-column-template": columnTemplate,
      }) as CSSProperties,
    [columnTemplate],
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
    <div className={styles.wrapper} style={wrapperStyle}>
      <div className={styles.toolbar}>
        {globalFilterKey || globalFilterFn
          ? (
            <label className={styles.searchLabel} htmlFor={searchInputId}>
              <span className="visually-hidden">Search table</span>
            </label>
          )
          : <div />}
        {globalFilterKey || globalFilterFn
          ? (
            <input
              id={searchInputId}
              className={styles.searchInput}
              value={globalFilter}
              placeholder={searchPlaceholder}
              onChange={(event) => setGlobalFilter(event.target.value)}
            />
          )
          : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleDownload}
        >
          Export CSV
        </Button>
      </div>

      <div className={styles.tableContainer} role="table" aria-busy={isLoading}>
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

        <div role="rowgroup" className={styles.body} ref={containerRef}>
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

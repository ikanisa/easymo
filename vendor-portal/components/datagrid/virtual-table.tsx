"use client";

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";
import { markTimeToFirstResult, startTimeToFirstResult } from "@/src/instrumentation/ux";

interface VirtualTableUxConfig {
  tableId: string;
  requestToken?: string;
  context?: Record<string, unknown>;
}

export interface VirtualTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  className?: string;
  tableHeight?: number;
  emptyState?: React.ReactNode;
  ux?: VirtualTableUxConfig;
}

interface ColumnMeta {
  template?: string;
  align?: "left" | "center" | "right";
  headerClassName?: string;
  cellClassName?: string;
}

type ColumnSize = {
  width?: string;
  minWidth?: string;
};

function parseTemplateSizing(template?: string): { minWidth?: number; weight: number } {
  if (!template) {
    return { weight: 1 };
  }
  const match = /minmax\(([^,]+),\s*([^\)]+)\)/.exec(template);
  if (!match) {
    return { weight: 1 };
  }
  const [minToken, weightToken] = match.slice(1);
  const minWidthValue = Number.parseFloat(minToken.replace("px", ""));
  const weightValue = Number.parseFloat(weightToken.replace("fr", ""));
  const minWidth = Number.isFinite(minWidthValue) ? minWidthValue : undefined;
  const weight = Number.isFinite(weightValue) && weightValue > 0 ? weightValue : 1;
  return { minWidth, weight };
}

function sizingToStyle(sizing: ColumnSize | undefined): CSSProperties | undefined {
  if (!sizing) {
    return undefined;
  }
  return {
    width: sizing.width,
    minWidth: sizing.minWidth,
  } satisfies CSSProperties;
}

export function VirtualTable<TData>({
  data,
  columns,
  className,
  tableHeight = 480,
  emptyState,
  ux,
}: VirtualTableProps<TData>) {
  // TanStack Table cannot be memoized safely by React Compiler; this hook needs to run on every render.

  const table = useReactTable<TData>({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const parentRef = useRef<HTMLDivElement | null>(null);

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 8,
  });

  const totalSize = rowVirtualizer.getTotalSize();
  const virtualItems = rowVirtualizer.getVirtualItems();

  const headerGroups = table.getHeaderGroups();

  const columnSizing = useMemo(() => {
    const firstGroup = headerGroups[0];
    if (!firstGroup) {
      return new Map<string, ColumnSize>();
    }
    const parsed = firstGroup.headers.map((header) => {
      const meta = header.column.columnDef.meta as ColumnMeta | undefined;
      const { minWidth, weight } = parseTemplateSizing(meta?.template);
      return {
        id: header.column.id,
        minWidth,
        weight,
      };
    });
    const totalWeight = parsed.reduce((sum, column) => sum + column.weight, 0) || 1;
    return new Map<string, ColumnSize>(
      parsed.map((column) => [
        column.id,
        {
          minWidth: column.minWidth ? `${column.minWidth}px` : undefined,
          width: `${(column.weight / totalWeight) * 100}%`,
        },
      ])
    );
  }, [headerGroups]);

  const columnCount = headerGroups[0]?.headers.length ?? 0;

  const ttfrRequestRef = useRef<string | null>(null);
  const ttfrMarkedRef = useRef(false);

  useEffect(() => {
    if (!ux?.tableId) {
      return;
    }
    const token = ux.requestToken ?? "default";
    const metricId = `${ux.tableId}:${token}`;
    if (ttfrRequestRef.current === metricId) {
      return;
    }
    ttfrRequestRef.current = metricId;
    ttfrMarkedRef.current = false;
    startTimeToFirstResult(metricId, {
      tableId: ux.tableId,
      requestToken: token,
      ...(ux.context ?? {}),
    });
  }, [ux?.tableId, ux?.requestToken, ux?.context]);

  useEffect(() => {
    if (!ux?.tableId || ttfrMarkedRef.current || !ttfrRequestRef.current) {
      return;
    }
    if (data.length === 0) {
      return;
    }
    ttfrMarkedRef.current = true;
    markTimeToFirstResult(ttfrRequestRef.current, {
      tableId: ux.tableId,
      rowCount: data.length,
    });
  }, [data.length, ux?.tableId]);

  const content = useMemo(() => {
    const rows = table.getRowModel().rows;

    if (columnCount === 0) {
      return null;
    }

    const headerRows = headerGroups.map((headerGroup) => (
      <tr key={headerGroup.id}>
        {headerGroup.headers.map((header) => {
          const meta = header.column.columnDef.meta as ColumnMeta | undefined;
          const alignClass =
            meta?.align === "right"
              ? "text-right"
              : meta?.align === "center"
                ? "text-center"
                : "text-left";
          const sizingStyle = sizingToStyle(columnSizing.get(header.column.id));
          return (
            <th
              key={header.id}
              scope="col"
              className={cn(
                "px-4 py-3 text-left text-xs uppercase tracking-[0.2em] text-neutral-2",
                alignClass,
                meta?.headerClassName
              )}
              style={sizingStyle}
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
            </th>
          );
        })}
      </tr>
    ));

    if (rows.length === 0) {
      return (
        <div
          ref={parentRef}
          className="relative overflow-auto"
          style={{ height: tableHeight }}
          role="region"
          aria-label={ux?.tableId ? `${ux.tableId} data table` : "Data table"}
        >
          <table
            className="min-w-full table-fixed border-collapse text-sm text-neutral-0"
            role="table"
            aria-rowcount={0}
            aria-colcount={columnCount}
          >
            <thead className="sticky top-0 z-20 bg-white/5 backdrop-blur">{headerRows}</thead>
            <tbody>
              <tr>
                <td colSpan={columnCount} className="px-6 py-12 text-center text-sm text-neutral-2">
                  {emptyState ?? "No data available"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      );
    }

    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom =
      virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

    return (
      <div
        ref={parentRef}
        className="relative overflow-auto"
        style={{ height: tableHeight }}
        role="region"
        aria-label={ux?.tableId ? `${ux.tableId} data table` : "Data table"}
      >
        <table
          className="min-w-full table-fixed border-collapse text-sm text-neutral-0"
          role="table"
          aria-rowcount={rows.length}
          aria-colcount={columnCount}
        >
          <thead className="sticky top-0 z-20 bg-white/5 backdrop-blur">{headerRows}</thead>
          <tbody>
            {paddingTop > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={columnCount}
                  style={{ height: `${paddingTop}px`, padding: 0, border: 0 }}
                />
              </tr>
            )}
            {virtualItems.map((virtualRow) => {
              const row = rows[virtualRow.index];
              return (
                <tr
                  key={row.id}
                  className="border-b border-white/10"
                  style={{
                    height: `${virtualRow.size}px`,
                    background:
                      virtualRow.index % 2 === 0
                        ? "rgba(255,255,255,0.04)"
                        : "rgba(255,255,255,0.02)",
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                    const alignClass =
                      meta?.align === "right"
                        ? "text-right"
                        : meta?.align === "center"
                          ? "text-center"
                          : "text-left";
                    const sizingStyle = sizingToStyle(columnSizing.get(cell.column.id));
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          "truncate px-4 py-3 align-top text-sm text-neutral-0",
                          alignClass,
                          meta?.cellClassName
                        )}
                        style={sizingStyle}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr aria-hidden="true">
                <td
                  colSpan={columnCount}
                  style={{ height: `${paddingBottom}px`, padding: 0, border: 0 }}
                />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }, [
    columnCount,
    columnSizing,
    emptyState,
    headerGroups,
    table,
    tableHeight,
    totalSize,
    ux?.tableId,
    virtualItems,
  ]);

  return (
    <div className={cn("overflow-hidden rounded-2xl border border-white/10 text-sm", className)}>
      {content}
    </div>
  );
}

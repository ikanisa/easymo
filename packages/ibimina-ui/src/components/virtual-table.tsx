"use client";

import { useEffect, useRef, useState, ReactNode, CSSProperties } from "react";
import { cn } from "../utils/cn";

export interface VirtualTableColumn<T> {
  key: string;
  header: ReactNode;
  width?: number | string;
  minWidth?: number;
  maxWidth?: number;
  render: (item: T, index: number) => ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
}

export interface VirtualTableProps<T> {
  data: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight?: number;
  overscan?: number;
  estimatedHeight?: number;
  onRowClick?: (item: T, index: number) => void;
  getRowKey: (item: T, index: number) => string;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  headerClassName?: string;
  rowClassName?: string | ((item: T, index: number) => string);
}

export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 56,
  overscan = 5,
  estimatedHeight = 600,
  onRowClick,
  getRowKey,
  loading = false,
  emptyMessage = "No data available",
  className,
  headerClassName,
  rowClassName,
}: VirtualTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(estimatedHeight);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerHeight(entry.contentRect.height);
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = data.length * rowHeight;
  const visibleStart = Math.floor(scrollTop / rowHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / rowHeight);
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(data.length, visibleEnd + overscan);
  const offsetY = startIndex * rowHeight;

  const visibleData = data.slice(startIndex, endIndex);

  if (loading) {
    return (
      <div
        className={cn(
          "rounded-xl border border-neutral-200/80 bg-white/70 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.55)] backdrop-blur-md dark:border-neutral-700/70 dark:bg-neutral-900/70",
          className
        )}
      >
        <VirtualTableSkeleton columns={columns} rowCount={10} rowHeight={rowHeight} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "rounded-xl border border-neutral-200/80 bg-white/70 p-12 text-center shadow-[0_18px_48px_-32px_rgba(15,23,42,0.55)] backdrop-blur-md dark:border-neutral-700/70 dark:bg-neutral-900/70",
          className
        )}
      >
        <p className="text-neutral-600 dark:text-neutral-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-xl border border-neutral-200/80 bg-white/70 shadow-[0_18px_48px_-32px_rgba(15,23,42,0.55)] backdrop-blur-md dark:border-neutral-700/70 dark:bg-neutral-900/70",
        className
      )}
    >
      {/* Header */}
      <div
        className={cn(
          "sticky top-0 z-10 border-b border-neutral-200/80 bg-white/70 backdrop-blur-md dark:border-neutral-700/70 dark:bg-neutral-900/80",
          headerClassName
        )}
      >
        <div className="flex">
          {columns.map((column) => (
            <div
              key={column.key}
              className={cn(
                "flex-shrink-0 px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.2em] text-neutral-700 dark:text-neutral-200",
                column.align === "center" && "text-center",
                column.align === "right" && "text-right"
              )}
              style={{
                width: column.width,
                minWidth: column.minWidth,
                maxWidth: column.maxWidth,
              }}
            >
              {column.header}
            </div>
          ))}
        </div>
      </div>

      {/* Virtual Scrollable Body */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="overflow-auto"
        style={{ height: estimatedHeight }}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          <div style={{ transform: `translateY(${offsetY}px)` }}>
            {visibleData.map((item, idx) => {
              const actualIndex = startIndex + idx;
              const rowKey = getRowKey(item, actualIndex);
              const rowClassNameValue =
                typeof rowClassName === "function" ? rowClassName(item, actualIndex) : rowClassName;

              return (
                <div
                  key={rowKey}
                  onClick={() => onRowClick?.(item, actualIndex)}
                  className={cn(
                    "flex border-b border-neutral-100/70 transition-colors dark:border-neutral-800/70",
                    onRowClick &&
                      "cursor-pointer hover:bg-white/80 hover:backdrop-blur-[2px] dark:hover:bg-neutral-800/70",
                    rowClassNameValue
                  )}
                  style={{ height: rowHeight }}
                >
                  {columns.map((column) => (
                    <div
                      key={column.key}
                      className={cn(
                        "flex flex-shrink-0 items-center px-4 text-sm text-neutral-900 dark:text-neutral-100",
                        column.align === "center" && "justify-center text-center",
                        column.align === "right" && "justify-end text-right"
                      )}
                      style={{
                        width: column.width,
                        minWidth: column.minWidth,
                        maxWidth: column.maxWidth,
                      }}
                    >
                      {column.render(item, actualIndex)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

interface VirtualTableSkeletonProps {
  columns: VirtualTableColumn<any>[];
  rowCount: number;
  rowHeight: number;
}

function VirtualTableSkeleton({ columns, rowCount, rowHeight }: VirtualTableSkeletonProps) {
  return (
    <>
      {/* Header */}
      <div className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex">
          {columns.map((column) => (
            <div
              key={column.key}
              className="flex-shrink-0 px-4 py-3"
              style={{
                width: column.width,
                minWidth: column.minWidth,
                maxWidth: column.maxWidth,
              }}
            >
              <div className="h-3 w-16 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      </div>

      {/* Skeleton Rows */}
      {Array.from({ length: rowCount }).map((_, idx) => (
        <div
          key={idx}
          className="flex border-b border-neutral-100 dark:border-neutral-800"
          style={{ height: rowHeight }}
        >
          {columns.map((column) => (
            <div
              key={column.key}
              className="flex flex-shrink-0 items-center px-4"
              style={{
                width: column.width,
                minWidth: column.minWidth,
                maxWidth: column.maxWidth,
              }}
            >
              <div className="h-4 w-full animate-pulse rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

/**
 * Simple virtualized list for single-column data
 */
export interface VirtualListProps<T> {
  data: T[];
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  renderItem: (item: T, index: number) => ReactNode;
  getItemKey: (item: T, index: number) => string;
  emptyMessage?: string;
  className?: string;
}

export function VirtualList<T>({
  data,
  itemHeight,
  containerHeight,
  overscan = 3,
  renderItem,
  getItemKey,
  emptyMessage = "No items",
  className,
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = data.length * itemHeight;
  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.ceil((scrollTop + containerHeight) / itemHeight);
  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(data.length, visibleEnd + overscan);
  const offsetY = startIndex * itemHeight;

  const visibleData = data.slice(startIndex, endIndex);

  if (data.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center p-8", className)}
        style={{ height: containerHeight }}
      >
        <p className="text-neutral-600 dark:text-neutral-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div
      className={cn("overflow-auto", className)}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleData.map((item, idx) => {
            const actualIndex = startIndex + idx;
            return (
              <div key={getItemKey(item, actualIndex)} style={{ height: itemHeight }}>
                {renderItem(item, actualIndex)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

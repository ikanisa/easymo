"use client";

import { ChevronDownIcon,ChevronUpIcon } from "@heroicons/react/24/outline";
import { type ReactNode,useMemo, useState } from "react";

type SortOrder = "asc" | "desc";

export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  render?: (value: T[keyof T], item: T) => ReactNode;
}

export interface DataTableProps<T extends { id: string | number }> {
  data: T[];
  columns: DataTableColumn<T>[];
  loading?: boolean;
  onRowClick?: (item: T) => void;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  loading,
  onRowClick,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const sortedData = useMemo(() => {
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortKey];
      const bValue = b[sortKey];

      if (aValue === bValue) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
      if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortOrder]);

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8">
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 rounded bg-gray-100" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((column) => {
              const isSorted = sortKey === column.key;

              return (
                <th
                  key={String(column.key)}
                  className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
                >
                  <button
                    type="button"
                    className="flex items-center gap-1 hover:text-gray-700"
                    disabled={!column.sortable}
                    onClick={() => column.sortable && handleSort(column.key)}
                  >
                    {column.label}
                    {column.sortable && isSorted && (
                      sortOrder === "asc" ? (
                        <ChevronUpIcon className="h-3 w-3" />
                      ) : (
                        <ChevronDownIcon className="h-3 w-3" />
                      )
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {sortedData.map((item) => (
            <tr
              key={item.id}
              onClick={() => onRowClick?.(item)}
              className={onRowClick ? "cursor-pointer hover:bg-gray-50" : undefined}
            >
              {columns.map((column) => (
                <td
                  key={String(column.key)}
                  className="whitespace-nowrap px-6 py-4 text-sm text-gray-900"
                >
                  {column.render
                    ? column.render(item[column.key], item)
                    : String(item[column.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {sortedData.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-gray-500">
                No records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

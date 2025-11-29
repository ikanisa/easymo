/**
 * Aurora DataTable Component
 * Sortable, filterable, paginated table with selection
 */

'use client';

import { AnimatePresence,motion } from 'framer-motion';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight,Search } from 'lucide-react';
import { useMemo,useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/utils';

import { Skeleton } from '../feedback/Skeleton';

export interface Column<T> {
  id: string;
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface DataTableProps<T extends { id: string }> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  searchable?: boolean;
  selectable?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  onSelectionChange?: (selectedIds: string[]) => void;
  emptyMessage?: string;
  className?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  loading = false,
  searchable = true,
  selectable = false,
  pageSize = 10,
  onRowClick,
  onSelectionChange,
  emptyMessage = 'No data found',
  className,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter data by search
  const filteredData = useMemo(() => {
    if (!search) return data;
    
    return data.filter((row) =>
      columns.some((col) => {
        const value = typeof col.accessor === 'function' 
          ? col.accessor(row) 
          : row[col.accessor];
        return String(value).toLowerCase().includes(search.toLowerCase());
      })
    );
  }, [data, search, columns]);

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;

    const column = columns.find((col) => col.id === sortColumn);
    if (!column) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aVal = typeof column.accessor === 'function' ? column.accessor(a) : a[column.accessor];
      const bVal = typeof column.accessor === 'function' ? column.accessor(b) : b[column.accessor];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      const comparison = aVal > bVal ? 1 : -1;
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredData, sortColumn, sortDirection, columns]);

  // Paginate data
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedData.length / pageSize);

  // Handle sort
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnId);
      setSortDirection('asc');
    }
  };

  // Handle selection
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
    onSelectionChange?.(Array.from(newSelected));
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedData.length) {
      setSelectedIds(new Set());
      onSelectionChange?.([]);
    } else {
      const allIds = new Set(paginatedData.map((row) => row.id));
      setSelectedIds(allIds);
      onSelectionChange?.(Array.from(allIds));
    }
  };

  const getCellValue = (row: T, column: Column<T>) => {
    return typeof column.accessor === 'function' 
      ? column.accessor(row) 
      : row[column.accessor];
  };

  return (
    <div className={cn('rounded-2xl border border-[var(--aurora-border)] bg-[var(--aurora-surface)] overflow-hidden', className)}>
      {/* Header with search */}
      {searchable && (
        <div className="p-4 border-b border-[var(--aurora-border)]">
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
          />
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--aurora-border)] bg-[var(--aurora-surface-muted)]">
              {selectable && (
                <th className="w-12 px-4 py-3">
                  <Checkbox
                    checked={selectedIds.size === paginatedData.length && paginatedData.length > 0}
                    indeterminate={selectedIds.size > 0 && selectedIds.size < paginatedData.length}
                    onChange={toggleSelectAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.id}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold text-[var(--aurora-text-muted)] uppercase tracking-wider',
                    column.align === 'center' && 'text-center',
                    column.align === 'right' && 'text-right'
                  )}
                  style={{ width: column.width }}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.id)}
                      className="flex items-center gap-1 hover:text-[var(--aurora-text-primary)] transition-colors"
                    >
                      {column.header}
                      {sortColumn === column.id ? (
                        sortDirection === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-50" />
                      )}
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--aurora-border)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {selectable && <td className="px-4 py-3"><Skeleton variant="rectangular" height={20} width={20} /></td>}
                  {columns.map((col) => (
                    <td key={col.id} className="px-4 py-3">
                      <Skeleton variant="text" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  className="px-4 py-12 text-center text-[var(--aurora-text-muted)]"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              <AnimatePresence mode="popLayout">
                {paginatedData.map((row, index) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'transition-colors duration-150',
                      onRowClick && 'cursor-pointer hover:bg-[var(--aurora-surface-muted)]',
                      selectedIds.has(row.id) && 'bg-[var(--aurora-accent)]/5'
                    )}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleSelection(row.id)}
                        />
                      </td>
                    )}
                    {columns.map((column) => (
                      <td
                        key={column.id}
                        className={cn(
                          'px-4 py-3 text-sm text-[var(--aurora-text-primary)]',
                          column.align === 'center' && 'text-center',
                          column.align === 'right' && 'text-right'
                        )}
                      >
                        {getCellValue(row, column) as React.ReactNode}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--aurora-border)]">
          <p className="text-sm text-[var(--aurora-text-muted)]">
            Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length} results
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-[var(--aurora-text-secondary)]">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

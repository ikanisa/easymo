"use client";

import { forwardRef, createContext, useContext } from "react";
import type { HTMLAttributes, TableHTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { clsx } from "clsx";

interface TableContextValue {
  compact: boolean;
  striped: boolean;
}

const TableContext = createContext<TableContextValue>({ compact: false, striped: false });

export interface DataTableProps extends TableHTMLAttributes<HTMLTableElement> {
  compact?: boolean;
  striped?: boolean;
}

export const DataTable = forwardRef<HTMLTableElement, DataTableProps>(function DataTable(
  { className, compact = false, striped = true, children, ...props },
  ref,
) {
  return (
    <TableContext.Provider value={{ compact, striped }}>
      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--ui-color-border)]/40 bg-[color:var(--ui-color-surface)]/80 shadow-[var(--ui-glass-shadow)]">
        <table
          ref={ref}
          className={clsx(
            "w-full min-w-[480px] border-collapse text-left text-sm text-[color:var(--ui-color-foreground)]",
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
});

DataTable.displayName = "DataTable";

export const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableHeader({ className, ...props }, ref) {
    return (
      <thead
        ref={ref}
        className={clsx(
          "bg-[color:var(--ui-color-surface-muted)]/70 text-xs uppercase tracking-[0.12em] text-[color:var(--ui-color-muted)]",
          className,
        )}
        {...props}
      />
    );
  },
);

export const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  function TableBody({ className, ...props }, ref) {
    return <tbody ref={ref} className={clsx("divide-y divide-[color:var(--ui-color-border)]/30", className)} {...props} />;
  },
);

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  function TableRow({ className, ...props }, ref) {
    const { striped } = useContext(TableContext);
    return (
      <tr
        ref={ref}
        className={clsx(
          "transition",
          striped && "odd:bg-[color:var(--ui-color-surface)]/70 even:bg-[color:var(--ui-color-surface-muted)]/40",
          "hover:bg-[color:var(--ui-color-surface-muted)]/60",
          className,
        )}
        {...props}
      />
    );
  },
);

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  function TableHead({ className, children, scope = "col", ...props }, ref) {
    const { compact } = useContext(TableContext);
    return (
      <th
        ref={ref}
        scope={scope}
        className={clsx(
          "px-4 text-xs font-semibold uppercase tracking-[0.08em] text-[color:var(--ui-color-muted)]",
          compact ? "py-2" : "py-3",
          className,
        )}
        {...props}
      >
        {children}
      </th>
    );
  },
);

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  function TableCell({ className, children, ...props }, ref) {
    const { compact } = useContext(TableContext);
    return (
      <td
        ref={ref}
        className={clsx(
          "px-4 text-sm text-[color:var(--ui-color-foreground)]",
          compact ? "py-2" : "py-3",
          className,
        )}
        {...props}
      >
        {children}
      </td>
    );
  },
);

export const TableCaption = ({ className, ...props }: HTMLAttributes<HTMLTableCaptionElement>) => (
  <caption
    className={clsx(
      "mt-3 text-start text-xs text-[color:var(--ui-color-muted)]",
      className,
    )}
    {...props}
  />
);

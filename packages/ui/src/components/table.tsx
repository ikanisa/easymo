"use client";

import { createContext, useContext } from "react";
import type { HTMLAttributes, TableHTMLAttributes } from "react";
import { clsx } from "clsx";

interface TableContextValue {
  zebra: boolean;
}

const TableContext = createContext<TableContextValue>({ zebra: false });

export interface TableProps
  extends TableHTMLAttributes<HTMLTableElement> {
  /**
   * Enable alternating row backgrounds.
   */
  zebra?: boolean;
}

export function Table({ zebra = false, className, children, ...props }: TableProps) {
  return (
    <TableContext.Provider value={{ zebra }}>
      <div className="relative overflow-x-auto">
        <table
          className={clsx(
            "w-full border-separate border-spacing-0 text-left text-sm text-[color:rgb(var(--easymo-colors-neutral-700))]",
            className,
          )}
          {...props}
        >
          {children}
        </table>
      </div>
    </TableContext.Provider>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={clsx(
        "sticky top-0 z-10 bg-[color:rgba(var(--easymo-colors-neutral-50),0.95)] text-[color:rgb(var(--easymo-colors-neutral-600))]",
        className,
      )}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={clsx("divide-y divide-[color:rgba(var(--easymo-colors-neutral-200),0.7)]", className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  const { zebra } = useContext(TableContext);
  return (
    <tr
      className={clsx(
        "transition hover:bg-[color:rgba(var(--easymo-colors-primary-100),0.4)]",
        zebra && "even:bg-[color:rgba(var(--easymo-colors-neutral-100),0.6)]",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={clsx(
        "px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[color:rgb(var(--easymo-colors-neutral-500))]",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: HTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={clsx(
        "px-4 py-3 align-middle text-sm text-[color:rgb(var(--easymo-colors-neutral-800))]",
        className,
      )}
      {...props}
    />
  );
}

export const TableFooter = ({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) => (
  <tfoot
    className={clsx(
      "bg-[color:rgba(var(--easymo-colors-neutral-100),0.9)] text-[color:rgb(var(--easymo-colors-neutral-600))]",
      className,
    )}
    {...props}
  />
);

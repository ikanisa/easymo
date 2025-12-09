import { Skeleton } from "@ibimina/ui";
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
}

/**
 * TableSkeleton - Loading skeleton for data tables
 * 
 * Provides a realistic loading state for table views with configurable
 * rows and columns. Matches the table structure for better perceived performance.
 */
export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  className,
  showHeader = true 
}: TableSkeletonProps) {
  return (
    <div 
      className={cn("w-full overflow-hidden rounded-xl border border-border", className)}
      role="status"
      aria-label="Loading table data"
    >
      {/* Table Header */}
      {showHeader && (
        <div className="grid gap-4 border-b border-border bg-surface-subtle px-6 py-4" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton 
              key={`header-${i}`} 
              className="h-4 w-24" 
              variant="text"
              aria-label={`Loading column ${i + 1} header`}
            />
          ))}
        </div>
      )}
      
      {/* Table Rows */}
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div 
            key={`row-${rowIndex}`}
            className="grid gap-4 px-6 py-4 hover:bg-surface-subtle/50 transition-colors" 
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={`cell-${rowIndex}-${colIndex}`} 
                className={cn(
                  "h-5",
                  colIndex === 0 ? "w-32" : colIndex === columns - 1 ? "w-20" : "w-full"
                )}
                variant="text"
                aria-label={`Loading row ${rowIndex + 1}, column ${colIndex + 1}`}
              />
            ))}
          </div>
        ))}
      </div>
      
      {/* Screen reader announcement */}
      <span className="sr-only" aria-live="polite">
        Loading table with {rows} rows and {columns} columns
      </span>
    </div>
  );
}

/**
 * DashboardCardSkeleton - Skeleton for dashboard KPI cards
 */
export function DashboardCardSkeleton({ className }: { className?: string }) {
  return (
    <div 
      className={cn(
        "rounded-2xl border border-border bg-surface p-6 space-y-3",
        className
      )}
      role="status"
      aria-label="Loading dashboard card"
    >
      <Skeleton className="h-4 w-24" variant="text" />
      <Skeleton className="h-8 w-32" variant="text" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-12" variant="text" />
        <Skeleton className="h-3 w-16" variant="text" />
      </div>
    </div>
  );
}

/**
 * FormSkeleton - Loading skeleton for forms
 */
export function FormSkeleton({ 
  fields = 4,
  className 
}: { 
  fields?: number; 
  className?: string;
}) {
  return (
    <div 
      className={cn("space-y-6", className)}
      role="status"
      aria-label="Loading form"
    >
      {Array.from({ length: fields }).map((_, i) => (
        <div key={`field-${i}`} className="space-y-2">
          <Skeleton className="h-4 w-32" variant="text" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ))}
      <div className="flex gap-3 pt-4">
        <Skeleton className="h-10 w-24 rounded-full" />
        <Skeleton className="h-10 w-24 rounded-full" />
      </div>
    </div>
  );
}

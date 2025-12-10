import { cn } from "../utils/cn";

interface SkeletonProps {
  className?: string;
  "aria-label"?: string;
  variant?: "default" | "text" | "circular" | "rectangular";
}

/**
 * Skeleton Component - Atlas UI Design System
 *
 * Loading placeholders that match content shapes.
 * Includes shimmer animation and accessibility support.
 */
export function Skeleton({
  className,
  "aria-label": ariaLabel,
  variant = "default",
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden bg-neutral-200 dark:bg-neutral-700 animate-pulse",
        variant === "default" && "rounded-lg",
        variant === "text" && "rounded h-4",
        variant === "circular" && "rounded-full",
        variant === "rectangular" && "rounded",
        className
      )}
      role={ariaLabel ? "status" : undefined}
      aria-label={ariaLabel || "Loading"}
      aria-live={ariaLabel ? "polite" : undefined}
    >
      <div
        className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 dark:via-white/20 to-transparent"
        aria-hidden="true"
        style={{
          animation: "shimmer 2s infinite",
        }}
      />
    </div>
  );
}

/**
 * Card Skeleton - Pre-built skeleton for card layouts
 */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("border border-neutral-200 dark:border-neutral-700 rounded-xl p-6 space-y-4", className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-3/4" variant="text" />
          <Skeleton className="h-4 w-full" variant="text" />
        </div>
        <Skeleton className="h-10 w-10" variant="circular" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" variant="text" />
        <Skeleton className="h-4 w-5/6" variant="text" />
      </div>
    </div>
  );
}

/**
 * List Item Skeleton
 */
export function ListItemSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 py-3", className)}>
      <Skeleton className="h-12 w-12" variant="circular" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" variant="text" />
        <Skeleton className="h-3 w-48" variant="text" />
      </div>
      <Skeleton className="h-6 w-20" variant="text" />
    </div>
  );
}

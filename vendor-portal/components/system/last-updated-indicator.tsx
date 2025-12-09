"use client";

import { useEffect, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface LastUpdatedIndicatorProps {
  timestamp: Date | string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  className?: string;
}

export function LastUpdatedIndicator({
  timestamp,
  onRefresh,
  isRefreshing = false,
  className,
}: LastUpdatedIndicatorProps) {
  const [relativeTime, setRelativeTime] = useState<string>("");

  useEffect(() => {
    if (!timestamp) {
      setRelativeTime("Never");
      return;
    }

    const updateRelativeTime = () => {
      const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSecs = Math.floor(diffMs / 1000);
      const diffMins = Math.floor(diffSecs / 60);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSecs < 10) {
        setRelativeTime("Just now");
      } else if (diffSecs < 60) {
        setRelativeTime(`${diffSecs}s ago`);
      } else if (diffMins < 60) {
        setRelativeTime(`${diffMins}m ago`);
      } else if (diffHours < 24) {
        setRelativeTime(`${diffHours}h ago`);
      } else {
        setRelativeTime(`${diffDays}d ago`);
      }
    };

    updateRelativeTime();
    const interval = setInterval(updateRelativeTime, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs text-neutral-600 dark:text-neutral-400",
        className
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      <span>
        Last updated: <time dateTime={timestamp?.toString()}>{relativeTime}</time>
      </span>
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className={cn(
            "ml-1 rounded-lg p-1.5 transition-colors hover:bg-neutral-200 disabled:opacity-50 dark:hover:bg-neutral-700",
            isRefreshing && "animate-spin"
          )}
          aria-label="Refresh data"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

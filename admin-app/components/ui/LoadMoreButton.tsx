"use client";

import { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface LoadMoreButtonProps {
  hasMore?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children?: ReactNode;
  className?: string;
}

export function LoadMoreButton({
  hasMore,
  loading,
  onClick,
  children,
  className,
}: LoadMoreButtonProps) {
  if (!hasMore) {
    return null;
  }

  return (
    <div className={className ?? "flex justify-center pt-3"} aria-live="polite">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={loading}
        onClick={onClick}
      >
        {<>{loading ? "Loading…" : (children ?? "Load more")}</>}
      </Button>
    </div>
  );
}

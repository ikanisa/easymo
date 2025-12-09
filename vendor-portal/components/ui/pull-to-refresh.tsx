"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface PullToRefreshProps {
  children: ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number;
  maxPull?: number;
  disabled?: boolean;
  className?: string;
}

/**
 * PullToRefresh - Mobile pull-to-refresh gesture handler
 * 
 * Implements native-like pull-to-refresh functionality for mobile web.
 * Supports both touch and mouse events for development/testing.
 */
export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  maxPull = 120,
  disabled = false,
  className,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;

    // Only trigger if scrolled to top
    if (container.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
    }
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (disabled || isRefreshing || startY === 0) return;

    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    if (distance > 0) {
      // Prevent default scrolling behavior only when pulling
      e.preventDefault();
      
      // Apply resistance curve
      const resistance = 0.5;
      const pull = Math.min(distance * resistance, maxPull);
      setPullDistance(pull);
    }
  }, [disabled, isRefreshing, startY, maxPull]);

  const handleTouchEnd = useCallback(async () => {
    if (disabled || isRefreshing) return;

    if (pullDistance >= threshold) {
      setIsRefreshing(true);
      try {
        await onRefresh();
      } catch (error) {
        console.error("Refresh failed:", error);
      } finally {
        setIsRefreshing(false);
      }
    }

    setStartY(0);
    setPullDistance(0);
  }, [disabled, isRefreshing, pullDistance, threshold, onRefresh]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Only use passive: false for touchmove to allow preventDefault
    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const triggerProgress = Math.min(pullDistance / threshold, 1);
  const shouldTrigger = pullDistance >= threshold;

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-y-auto", className)}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 top-0 flex items-center justify-center transition-opacity",
          pullDistance > 0 || isRefreshing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? "transform 0.3s ease-out, opacity 0.3s" : "none",
        }}
      >
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
            shouldTrigger 
              ? "border-primary-500 bg-primary-500/20 text-primary-400 scale-110" 
              : "border-border bg-surface text-foreground-muted scale-100"
          )}
        >
          <RefreshCw
            className={cn(
              "h-5 w-5 transition-transform",
              isRefreshing && "animate-spin"
            )}
            style={{
              transform: isRefreshing ? undefined : `rotate(${triggerProgress * 360}deg)`,
            }}
            aria-hidden="true"
          />
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance === 0 ? "transform 0.3s ease-out" : "none",
        }}
      >
        {children}
      </div>

      {/* Screen reader status */}
      {isRefreshing && (
        <span className="sr-only" role="status" aria-live="polite">
          Refreshing content
        </span>
      )}
    </div>
  );
}

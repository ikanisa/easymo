'use client';

import { useRef, useState, useCallback, useEffect, ReactNode } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Loader2, ArrowDown } from 'lucide-react';
import { useAdvancedHaptics } from '@/lib/haptics';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  threshold?: number;
  className?: string;
}

export function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  className = '',
}: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const isDragging = useRef(false);
  const haptics = useAdvancedHaptics();

  const pullDistance = useMotionValue(0);
  const pullProgress = useTransform(pullDistance, [0, threshold], [0, 1]);
  const iconRotation = useTransform(pullDistance, [0, threshold], [0, 180]);
  const iconScale = useTransform(pullDistance, [0, threshold * 0.5, threshold], [0.5, 1, 1.2]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0 && !isRefreshing) {
      startY.current = e.touches[0].clientY;
      isDragging.current = true;
    }
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging.current) return;

    currentY.current = e.touches[0].clientY;
    const distance = Math.max(0, currentY.current - startY.current);

    // Apply rubber band effect
    const rubberBandDistance = Math.pow(distance, 0.85);
    pullDistance.set(Math.min(rubberBandDistance, threshold * 1.5));

    // Haptic feedback at threshold
    if (distance >= threshold && distance < threshold + 5) {
      haptics.trigger('selection');
    }

    // Prevent default scrolling when pulling down
    if (distance > 10) {
      e.preventDefault();
    }
  }, [threshold, haptics, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!isDragging.current) return;

    const distance = pullDistance.get();
    isDragging.current = false;

    if (distance >= threshold) {
      setIsRefreshing(true);
      haptics.trigger('medium');
      pullDistance.set(threshold);

      try {
        await onRefresh();
      } finally {
        animate(pullDistance, 0, {
          type: 'spring',
          stiffness: 200,
          damping: 20,
        });
        setIsRefreshing(false);
      }
    } else {
      animate(pullDistance, 0, {
        type: 'spring',
        stiffness: 300,
        damping: 25,
      });
    }
  }, [threshold, onRefresh, haptics, pullDistance]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return (
    <div ref={containerRef} className={`relative overflow-auto ${className}`}>
      {/* Pull indicator */}
      <motion.div
        style={{
          height: pullDistance,
        }}
        className="absolute top-0 left-0 right-0 flex items-end justify-center pb-2 bg-gradient-to-b from-background/80 to-transparent backdrop-blur-sm z-50"
      >
        <motion.div
          style={{
            rotate: iconRotation,
            scale: iconScale,
            opacity: pullProgress,
          }}
          className="flex items-center gap-2 text-muted-foreground"
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <ArrowDown className="w-5 h-5" />
          )}
          <span className="text-sm font-medium">
            {isRefreshing ? 'Refreshing...' : 'Pull to refresh'}
          </span>
        </motion.div>
      </motion.div>

      {children}
    </div>
  );
}

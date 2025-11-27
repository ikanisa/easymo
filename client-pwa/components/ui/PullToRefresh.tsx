'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Loader2, ArrowDown } from 'lucide-react';
import { useHaptics } from '@/hooks/useHaptics';
import { cn } from '@/lib/utils';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
}

const PULL_THRESHOLD = 80;
const MAX_PULL = 120;

export function PullToRefresh({ children, onRefresh, disabled }: PullToRefreshProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const { trigger } = useHaptics();
  
  const pullDistance = useMotionValue(0);
  const pullProgress = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 1]);
  const rotation = useTransform(pullDistance, [0, PULL_THRESHOLD], [0, 180]);
  const opacity = useTransform(pullDistance, [0, PULL_THRESHOLD / 2], [0, 1]);
  const scale = useTransform(pullDistance, [0, PULL_THRESHOLD], [0.5, 1]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      pullDistance.set(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const diff = Math.max(0, currentY - startY.current);
    const dampedDiff = Math.min(MAX_PULL, diff * 0.5);
    
    pullDistance.set(dampedDiff);

    if (dampedDiff >= PULL_THRESHOLD && pullDistance.getPrevious() < PULL_THRESHOLD) {
      trigger('medium');
    }
  }, [isPulling, disabled, isRefreshing, pullDistance, trigger]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance.get() >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      trigger('heavy');
      
      animate(pullDistance, 60, { type: 'spring', stiffness: 400, damping: 30 });
      
      try {
        await onRefresh();
      } finally {
        animate(pullDistance, 0, { type: 'spring', stiffness: 400, damping: 30 });
        setIsRefreshing(false);
      }
    } else {
      animate(pullDistance, 0, { type: 'spring', stiffness: 400, damping: 30 });
    }
  }, [isPulling, pullDistance, isRefreshing, trigger, onRefresh]);

  return (
    <div className="relative h-full overflow-hidden">
      <motion.div
        style={{ y: pullDistance, opacity }}
        className="absolute top-0 left-0 right-0 flex justify-center items-center py-4 z-10"
      >
        <motion.div
          style={{ scale, rotate: isRefreshing ? undefined : rotation }}
          className={cn(
            'w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center',
            isRefreshing && 'animate-pulse'
          )}
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <motion.div style={{ rotate: rotation }}>
              <ArrowDown className="w-5 h-5 text-primary" />
            </motion.div>
          )}
        </motion.div>
      </motion.div>

      <motion.div
        ref={containerRef}
        style={{ y: pullDistance }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="h-full overflow-y-auto overscroll-y-contain"
      >
        {children}
      </motion.div>
    </div>
  );
}

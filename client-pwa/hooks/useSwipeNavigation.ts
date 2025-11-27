'use client';

import { useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useViewTransition } from '@/lib/view-transitions';
import { useHaptics } from './useHaptics';

interface SwipeNavigationOptions {
  threshold?: number;
  edgeWidth?: number;
  onSwipeBack?: () => void;
}

export function useSwipeNavigation(options: SwipeNavigationOptions = {}) {
  const { threshold = 100, edgeWidth = 30, onSwipeBack } = options;
  const { back } = useViewTransition();
  const { trigger } = useHaptics();
  
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const isEdgeSwipe = useRef(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartX.current = touch.clientX;
    
    isEdgeSwipe.current = touch.clientX < edgeWidth;
    
    if (isEdgeSwipe.current) {
      overlayRef.current = document.createElement('div');
      overlayRef.current.className = 'fixed inset-y-0 left-0 w-1 bg-primary/50 z-50 transition-all';
      document.body.appendChild(overlayRef.current);
    }
  }, [edgeWidth]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isEdgeSwipe.current || !overlayRef.current) return;
    
    const touch = e.touches[0];
    touchCurrentX.current = touch.clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    
    if (diff > 0) {
      const progress = Math.min(diff / threshold, 1);
      overlayRef.current.style.width = `${Math.min(diff, 100)}px`;
      overlayRef.current.style.opacity = `${0.5 + progress * 0.5}`;
      
      if (progress >= 1 && diff - threshold < 10) {
        trigger('medium');
      }
    }
  }, [threshold, trigger]);

  const handleTouchEnd = useCallback(() => {
    if (!isEdgeSwipe.current) return;
    
    const diff = touchCurrentX.current - touchStartX.current;
    
    if (overlayRef.current) {
      overlayRef.current.remove();
      overlayRef.current = null;
    }
    
    if (diff > threshold) {
      trigger('light');
      if (onSwipeBack) {
        onSwipeBack();
      } else {
        back();
      }
    }
    
    isEdgeSwipe.current = false;
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  }, [threshold, trigger, back, onSwipeBack]);

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);
}

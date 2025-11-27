/**
 * useHaptics Hook
 * Advanced haptic feedback with sound effects
 */

import { useCallback } from 'react';
import { haptics } from '@/lib/haptics';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'impact';

export function useHaptics() {
  const trigger = useCallback((pattern: HapticPattern, options?: { sound?: string }) => {
    haptics.trigger(pattern, options as any);
  }, []);

  const addToCart = useCallback(() => {
    haptics.addToCart();
  }, []);

  const removeFromCart = useCallback(() => {
    haptics.removeFromCart();
  }, []);

  const checkout = useCallback(() => {
    haptics.checkout();
  }, []);

  const orderConfirmed = useCallback(() => {
    haptics.orderConfirmed();
  }, []);

  const error = useCallback(() => {
    haptics.error();
  }, []);

  const notification = useCallback(() => {
    haptics.notification();
  }, []);

  return {
    trigger,
    addToCart,
    removeFromCart,
    checkout,
    orderConfirmed,
    error,
    notification,
  };
}

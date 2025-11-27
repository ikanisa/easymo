'use client';

import { useCallback } from 'react';

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'impact';

const vibrationPatterns: Record<HapticPattern, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 50,
  success: [10, 50, 10],
  warning: [30, 100, 30],
  error: [50, 100, 50, 100, 50],
  selection: 5,
  impact: 15,
};

export function useHaptics() {
  const trigger = useCallback((pattern: HapticPattern = 'light') => {
    // Check if vibration API is available
    if (!navigator.vibrate) {
      return;
    }

    const vibration = vibrationPatterns[pattern];
    navigator.vibrate(vibration);
  }, []);

  // Convenience methods
  const addToCart = useCallback(() => trigger('success'), [trigger]);
  const checkout = useCallback(() => trigger('heavy'), [trigger]);
  const error = useCallback(() => trigger('error'), [trigger]);
  const notification = useCallback(() => trigger('medium'), [trigger]);

  return {
    trigger,
    addToCart,
    checkout,
    error,
    notification,
  };
}

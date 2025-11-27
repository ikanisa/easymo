import { useCallback } from 'react';

type HapticIntensity = 'light' | 'medium' | 'heavy' | 'selection';

export function useHaptics() {
  const trigger = useCallback((intensity: HapticIntensity = 'light') => {
    // Check if haptic feedback is available
    if ('vibrate' in navigator) {
      const patterns = {
        light: 10,
        medium: 20,
        heavy: 30,
        selection: 5,
      };
      navigator.vibrate(patterns[intensity]);
    }
    
    // For iOS devices with Haptic Engine
    if ('ontouchstart' in window && 'HapticFeedback' in window) {
      try {
        // @ts-ignore - iOS specific API
        window.HapticFeedback.selection();
      } catch (e) {
        // Fallback handled above
      }
    }
  }, []);

  // Additional helper methods for common actions
  const notification = useCallback(() => trigger('medium'), [trigger]);
  const orderConfirmed = useCallback(() => {
    // Success pattern
    if ('vibrate' in navigator) {
      navigator.vibrate([10, 50, 20, 50, 30]);
    }
  }, []);
  const checkout = useCallback(() => trigger('heavy'), [trigger]);
  const error = useCallback(() => {
    // Error pattern
    if ('vibrate' in navigator) {
      navigator.vibrate([50, 100, 50, 100, 50]);
    }
  }, []);

  return { trigger, notification, orderConfirmed, checkout, error };
}

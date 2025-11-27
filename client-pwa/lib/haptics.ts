/**
 * Advanced Haptic Feedback System
 * Provides native-feeling tactile feedback across all interactions
 */

type HapticPattern = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection' | 'impact';

interface HapticConfig {
  pattern: number[];
  duration?: number;
}

const HAPTIC_PATTERNS: Record<HapticPattern, HapticConfig> = {
  light: { pattern: [10] },
  medium: { pattern: [20] },
  heavy: { pattern: [30] },
  success: { pattern: [10, 50, 20, 50, 30] },
  warning: { pattern: [30, 100, 30] },
  error: { pattern: [50, 100, 50, 100, 50] },
  selection: { pattern: [5] },
  impact: { pattern: [15, 30, 50] },
};

// Sound effects for enhanced feedback
const SOUNDS = {
  tap: '/sounds/tap.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  addToCart: '/sounds/pop.mp3',
  checkout: '/sounds/cha-ching.mp3',
  notification: '/sounds/notification.mp3',
} as const;

class HapticEngine {
  private audioContext: AudioContext | null = null;
  private soundCache: Map<string, AudioBuffer> = new Map();
  private isSupported: boolean;
  private soundEnabled: boolean = true;

  constructor() {
    this.isSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    if (typeof window !== 'undefined') {
      this.preloadSounds();
    }
  }

  private async preloadSounds() {
    if (typeof window === 'undefined') return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      for (const [key, url] of Object.entries(SOUNDS)) {
        try {
          const response = await fetch(url);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
          this.soundCache.set(key, audioBuffer);
        } catch {
          console.warn(`Failed to preload sound: ${key}`);
        }
      }
    } catch {
      console.warn('Audio context not available');
    }
  }

  private playSound(soundKey: keyof typeof SOUNDS) {
    if (!this.soundEnabled || !this.audioContext) return;
    
    const buffer = this.soundCache.get(soundKey);
    if (!buffer) return;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.start(0);
  }

  trigger(pattern: HapticPattern, options?: { sound?: keyof typeof SOUNDS }) {
    // Vibration
    if (this.isSupported) {
      const config = HAPTIC_PATTERNS[pattern];
      navigator.vibrate(config.pattern);
    }

    // iOS Taptic Engine fallback via CSS
    if (typeof window !== 'undefined' && 'ontouchstart' in window) {
      const el = document.createElement('div');
      el.style.cssText = `
        position: fixed;
        left: -9999px;
        -webkit-tap-highlight-color: transparent;
      `;
      document.body.appendChild(el);
      el.click();
      setTimeout(() => el.remove(), 10);
    }

    // Sound effect
    if (options?.sound) {
      this.playSound(options.sound);
    }
  }

  // Special patterns for specific actions
  addToCart() {
    this.trigger('success', { sound: 'addToCart' });
  }

  removeFromCart() {
    this.trigger('medium');
  }

  checkout() {
    this.trigger('heavy', { sound: 'checkout' });
  }

  orderConfirmed() {
    this.trigger('success', { sound: 'success' });
  }

  error() {
    this.trigger('error', { sound: 'error' });
  }

  notification() {
    this.trigger('medium', { sound: 'notification' });
  }

  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
  }
}

export const haptics = new HapticEngine();

// React Hook
export function useHaptics() {
  return {
    trigger: haptics.trigger.bind(haptics),
    addToCart: haptics.addToCart.bind(haptics),
    removeFromCart: haptics.removeFromCart.bind(haptics),
    checkout: haptics.checkout.bind(haptics),
    orderConfirmed: haptics.orderConfirmed.bind(haptics),
    error: haptics.error.bind(haptics),
    notification: haptics.notification.bind(haptics),
  };
}

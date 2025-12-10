/**
 * Sound Effects System for Bar Manager
 * Provides audio feedback for important events
 */

import { sounds } from './design-tokens';

type SoundEffect = keyof typeof sounds;

class SoundManager {
  private audio: Map<SoundEffect, HTMLAudioElement> = new Map();
  private enabled = true;
  private volume = 0.7;

  constructor() {
    if (typeof window !== 'undefined') {
      this.preloadSounds();
    }
  }

  private preloadSounds() {
    Object.entries(sounds).forEach(([key, path]) => {
      const audio = new Audio(path);
      audio.volume = this.volume;
      audio.preload = 'auto';
      this.audio.set(key as SoundEffect, audio);
    });
  }

  play(sound: SoundEffect) {
    if (!this.enabled) return;

    const audio = this.audio.get(sound);
    if (audio) {
      // Clone and play to allow overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = this.volume;
      clone.play().catch((error) => {
        console.warn('Failed to play sound:', error);
      });
    }
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundEnabled', enabled.toString());
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.audio.forEach((audio) => {
      audio.volume = this.volume;
    });
    if (typeof window !== 'undefined') {
      localStorage.setItem('soundVolume', this.volume.toString());
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getVolume(): number {
    return this.volume;
  }
}

// Singleton instance
export const soundManager = new SoundManager();

// Hook for React components
export function useSoundEffects() {
  const [enabled, setEnabled] = useState(soundManager.isEnabled());
  const [volume, setVolume] = useState(soundManager.getVolume());

  useEffect(() => {
    // Load settings from localStorage
    const savedEnabled = localStorage.getItem('soundEnabled');
    const savedVolume = localStorage.getItem('soundVolume');

    if (savedEnabled !== null) {
      const isEnabled = savedEnabled === 'true';
      soundManager.setEnabled(isEnabled);
      setEnabled(isEnabled);
    }

    if (savedVolume !== null) {
      const vol = parseFloat(savedVolume);
      soundManager.setVolume(vol);
      setVolume(vol);
    }
  }, []);

  const playSound = useCallback((sound: SoundEffect) => {
    soundManager.play(sound);
  }, []);

  const toggleSound = useCallback(() => {
    const newEnabled = !enabled;
    soundManager.setEnabled(newEnabled);
    setEnabled(newEnabled);
  }, [enabled]);

  const changeVolume = useCallback((newVolume: number) => {
    soundManager.setVolume(newVolume);
    setVolume(newVolume);
  }, []);

  return {
    enabled,
    volume,
    playSound,
    setEnabled: soundManager.setEnabled.bind(soundManager),
    setVolume: changeVolume,
    toggleSound,
  };
}

// Import for the hook
import { useState, useEffect, useCallback } from 'react';

import { useEffect, useCallback, useRef, useState } from 'react';

const SOUND_FILES = {
  newOrder: '/sounds/new-order.mp3',
  orderReady: '/sounds/order-ready.mp3',
  success: '/sounds/success.mp3',
  error: '/sounds/error.mp3',
  notification: '/sounds/notification.mp3',
  alert: '/sounds/alert.mp3',
};

export function useSoundEffects() {
  const [enabled, setEnabled] = useState(true);
  const soundsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    Object.entries(SOUND_FILES).forEach(([name, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.volume = 0.7;
      soundsRef.current.set(name, audio);
    });

    return () => {
      soundsRef.current.forEach((audio) => {
        audio.pause();
        audio.src = '';
      });
      soundsRef.current.clear();
    };
  }, []);

  const playSound = useCallback(
    (soundName: keyof typeof SOUND_FILES) => {
      if (!enabled) return;
      const audio = soundsRef.current.get(soundName);
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
    },
    [enabled]
  );

  return { playSound, enabled, setEnabled };
}

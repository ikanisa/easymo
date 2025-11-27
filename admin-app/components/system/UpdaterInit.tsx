'use client';

import { useEffect } from 'react';
import { checkForUpdates } from '@/lib/updater';

export function UpdaterInit() {
  useEffect(() => {
    // Only check for updates in window context (desktop)
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      checkForUpdates();
    }
  }, []);

  return null;
}

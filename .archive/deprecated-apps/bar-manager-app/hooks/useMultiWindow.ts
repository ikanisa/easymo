/**
 * Multi-Window Management Hook
 * Manages multiple windows for desktop app
 */

import { useCallback, useEffect, useState } from 'react';

interface WindowConfig {
  id: string;
  title: string;
  url: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
}

export function useMultiWindow() {
  const [openWindows, setOpenWindows] = useState<Map<string, Window>>(new Map());

  const openWindow = useCallback((config: WindowConfig) => {
    const {
      id,
      title,
      url,
      width = 1200,
      height = 800,
      x = 100,
      y = 100,
    } = config;

    // Close existing window if open
    const existing = openWindows.get(id);
    if (existing && !existing.closed) {
      existing.focus();
      return existing;
    }

    // Open new window
    const features = `width=${width},height=${height},left=${x},top=${y},menubar=no,toolbar=no,location=no,status=no`;
    const newWindow = window.open(url, id, features);

    if (newWindow) {
      newWindow.document.title = title;
      setOpenWindows((prev) => new Map(prev).set(id, newWindow));
    }

    return newWindow;
  }, [openWindows]);

  const closeWindow = useCallback((id: string) => {
    const window = openWindows.get(id);
    if (window && !window.closed) {
      window.close();
    }
    setOpenWindows((prev) => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, [openWindows]);

  const openKDS = useCallback(() => {
    return openWindow({
      id: 'kds',
      title: 'Kitchen Display System',
      url: '/kds',
      width: 1920,
      height: 1080,
    });
  }, [openWindow]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      openWindows.forEach((window) => {
        if (!window.closed) {
          window.close();
        }
      });
    };
  }, [openWindows]);

  return {
    openWindow,
    closeWindow,
    openKDS,
    openWindows: Array.from(openWindows.keys()),
  };
}

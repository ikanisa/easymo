'use client';

import { useEffect, useState, createContext, useContext, type ReactNode } from 'react';

interface PWAContextType {
  isInstalled: boolean;
  isOnline: boolean;
  canInstall: boolean;
  swVersion: string | null;
  install: () => Promise<void>;
  update: () => void;
}

const PWAContext = createContext<PWAContextType>({
  isInstalled: false,
  isOnline: true,
  canInstall: false,
  swVersion: null,
  install: async () => {},
  update: () => {},
});

export function usePWA() {
  return useContext(PWAContext);
}

interface PWAProviderProps {
  children: ReactNode;
}

export function PWAProvider({ children }: PWAProviderProps) {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [canInstall, setCanInstall] = useState(false);
  const [swVersion, setSwVersion] = useState<string | null>(null);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    // Online/offline detection
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };
    
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Service Worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.v4.js', { scope: '/' })
        .then((reg) => {
          setRegistration(reg);
          console.log('[PWA] Service Worker registered');

          // Check for updates periodically
          setInterval(() => {
            reg.update();
          }, 60 * 60 * 1000); // Every hour
        })
        .catch((error) => {
          console.warn('[PWA] Service Worker registration failed:', error);
        });

      // Listen for SW messages
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, version } = event.data || {};
        
        switch (type) {
          case 'SW_ACTIVATED':
            setSwVersion(version);
            setShowUpdateToast(true);
            break;
          case 'SW_BACKGROUND_SYNC_SUCCESS':
            // Show success notification
            break;
          case 'SW_BACKGROUND_SYNC_QUEUED':
            // Show queued notification
            break;
        }
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setCanInstall(false);
    }
    
    setDeferredPrompt(null);
  };

  const update = () => {
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
    window.location.reload();
  };

  return (
    <PWAContext.Provider
      value={{
        isInstalled,
        isOnline,
        canInstall,
        swVersion,
        install,
        update,
      }}
    >
      {children}
      
      {/* Offline Banner */}
      {!isOnline && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 
                        px-4 py-2 text-center text-sm font-medium">
          📶 You're offline. Some features may be limited.
        </div>
      )}
      
      {/* Update Toast */}
      {showUpdateToast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-slate-800 text-white 
                        px-4 py-3 rounded-lg shadow-lg border border-slate-700">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <p className="font-medium">Update Available</p>
              <p className="text-sm text-slate-300 mt-1">
                A new version is ready. Refresh to update.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={update}
                className="px-3 py-1 bg-sky-500 hover:bg-sky-600 rounded text-sm font-medium"
              >
                Refresh
              </button>
              <button
                onClick={() => setShowUpdateToast(false)}
                className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </PWAContext.Provider>
  );
}

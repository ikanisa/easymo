'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share, Plus, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAdvancedHaptics } from '@/lib/haptics';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const haptics = useAdvancedHaptics();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const dismissedAt = localStorage.getItem('pwa-prompt-dismissed');
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const daysSinceDismissed = (Date.now() - dismissedTime) / (1000 * 60 * 60 * 24);
      if (daysSinceDismissed < 7) return;
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 30000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIOS && !window.matchMedia('(display-mode: standalone)').matches) {
      setTimeout(() => setShowIOSGuide(true), 30000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    haptics.trigger('medium');
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
      haptics.orderConfirmed();
    }
    
    setDeferredPrompt(null);
    setShowPrompt(false);
  }, [deferredPrompt, haptics]);

  const handleDismiss = useCallback(() => {
    haptics.trigger('light');
    setShowPrompt(false);
    setShowIOSGuide(false);
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
  }, [haptics]);

  if (isInstalled) return null;

  return (
    <AnimatePresence>
      {showPrompt && deferredPrompt && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className={cn(
            'fixed bottom-0 inset-x-0 z-50',
            'p-4 pb-safe m-4 rounded-2xl',
            'bg-card border border-border shadow-2xl'
          )}
        >
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-8 h-8 text-white" />
            </div>
            
            <div className="flex-1">
              <h3 className="font-semibold text-lg">Install EasyMO</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add to your home screen for quick access and a better experience
              </p>
              
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleInstall}
                  className={cn(
                    'flex-1 py-3 rounded-xl font-medium',
                    'bg-primary text-primary-foreground',
                    'flex items-center justify-center gap-2',
                    'active:scale-95 transition-transform'
                  )}
                >
                  <Download className="w-5 h-5" />
                  Install App
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-3 rounded-xl font-medium bg-muted"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {showIOSGuide && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className={cn(
            'fixed bottom-0 inset-x-0 z-50',
            'p-4 pb-safe m-4 rounded-2xl',
            'bg-card border border-border shadow-2xl'
          )}
        >
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center">
              <Plus className="w-8 h-8 text-white" />
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">Install EasyMO</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Add to your home screen for the best experience
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <span>Tap</span>
              <div className="p-2 rounded-lg bg-muted">
                <Share className="w-5 h-5 text-primary" />
              </div>
              <span>then</span>
              <span className="font-medium text-foreground">&ldquo;Add to Home Screen&rdquo;</span>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full py-3 rounded-xl font-medium bg-muted"
            >
              Got it
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

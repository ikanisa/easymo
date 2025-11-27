'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { Button } from '@/components/ui/Button';
import { logStructuredEvent } from '@/lib/observability';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const { trigger } = useHaptics();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const standalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(standalone);

    // Check if iOS
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(ios);

    // Check if prompt was already dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const dismissedTime = dismissed ? parseInt(dismissed, 10) : 0;
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    // Don't show if already installed or recently dismissed
    if (standalone || dismissedTime > oneWeekAgo) {
      return;
    }

    // Listen for install prompt (Android/Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after 30 seconds
      setTimeout(() => {
        setShowPrompt(true);
        logStructuredEvent('PWA_INSTALL_PROMPT_SHOWN', { platform: 'android' });
      }, 30000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show iOS prompt after 30 seconds if on iOS Safari
    if (ios && !standalone) {
      setTimeout(() => {
        setShowPrompt(true);
        logStructuredEvent('PWA_INSTALL_PROMPT_SHOWN', { platform: 'ios' });
      }, 30000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    trigger('medium');
    deferredPrompt.prompt();

    const { outcome } = await deferredPrompt.userChoice;

    logStructuredEvent('PWA_INSTALL_RESPONSE', {
      outcome,
      platform: 'android',
    });

    if (outcome === 'accepted') {
      setShowPrompt(false);
    }

    setDeferredPrompt(null);
  }, [deferredPrompt, trigger]);

  const handleDismiss = useCallback(() => {
    trigger('light');
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());

    logStructuredEvent('PWA_INSTALL_DISMISSED', {
      platform: isIOS ? 'ios' : 'android',
    });
  }, [trigger, isIOS]);

  // Don't show if already installed
  if (isStandalone || !showPrompt) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'p-4 pb-safe-bottom',
          'bg-card border-t border-border shadow-lg'
        )}
      >
        <div className="max-w-md mx-auto">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Download className="w-6 h-6 text-primary" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-foreground font-semibold mb-1">
                Install EasyMO
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {isIOS
                  ? 'Add to your home screen for quick access and offline menu viewing'
                  : 'Install our app for faster access and offline menu viewing'}
              </p>

              {/* iOS instructions */}
              {isIOS ? (
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2">
                    1. Tap the <Share2 className="w-4 h-4 inline" /> share button
                  </p>
                  <p>2. Scroll and tap &quot;Add to Home Screen&quot;</p>
                  <p>3. Tap &quot;Add&quot;</p>
                </div>
              ) : (
                <Button
                  onClick={handleInstall}
                  className="w-full"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Install Now
                </Button>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 w-8 h-8 rounded-full hover:bg-muted flex items-center justify-center transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

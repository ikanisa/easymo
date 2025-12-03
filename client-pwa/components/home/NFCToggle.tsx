'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Nfc, NfcIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

interface NFCToggleProps {
  className?: string;
  onStateChange?: (enabled: boolean) => void;
}

// Persist NFC state in localStorage
const NFC_STATE_KEY = 'nfc_writer_enabled';

export function NFCToggle({ className, onStateChange }: NFCToggleProps) {
  const { trigger } = useHaptics();
  const [isEnabled, setIsEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(true);

  // Load persisted state and check NFC support
  useEffect(() => {
    // Check if NFC is supported
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setIsSupported(true);
    } else {
      setIsSupported(false);
    }

    // Load persisted state
    const stored = localStorage.getItem(NFC_STATE_KEY);
    if (stored !== null) {
      setIsEnabled(stored === 'true');
    }
  }, []);

  const handleToggle = useCallback(() => {
    if (!isSupported) {
      trigger('error');
      return;
    }

    const newState = !isEnabled;
    setIsEnabled(newState);
    localStorage.setItem(NFC_STATE_KEY, String(newState));
    trigger(newState ? 'success' : 'light');
    onStateChange?.(newState);
  }, [isEnabled, isSupported, onStateChange, trigger]);

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={handleToggle}
      disabled={!isSupported}
      className={cn(
        'w-full flex items-center justify-between gap-4 p-4',
        'bg-card border-2 rounded-2xl transition-all',
        isEnabled
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50',
        !isSupported && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center transition-colors',
            isEnabled
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          )}
        >
          {isEnabled ? (
            <Nfc className="w-6 h-6" />
          ) : (
            <NfcIcon className="w-6 h-6" />
          )}
        </div>
        <div className="text-left">
          <p className="font-semibold">NFC Writer</p>
          <p className="text-sm text-muted-foreground">
            {!isSupported
              ? 'NFC not supported on this device'
              : isEnabled
              ? 'NFC is enabled'
              : 'Tap to enable NFC'}
          </p>
        </div>
      </div>

      {/* Toggle Switch */}
      {isSupported && (
        <div
          className={cn(
            'w-14 h-8 rounded-full p-1 transition-colors',
            isEnabled ? 'bg-primary' : 'bg-muted'
          )}
        >
          <motion.div
            className="w-6 h-6 rounded-full bg-white shadow-sm"
            initial={false}
            animate={{
              x: isEnabled ? 24 : 0,
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </div>
      )}
    </motion.button>
  );
}

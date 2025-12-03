'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Delete, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';

interface AmountInputProps {
  value: number;
  onChange: (value: number) => void;
  currencySymbol?: string;
  currencyCode?: string;
  maxAmount?: number;
  minAmount?: number;
  placeholder?: string;
  className?: string;
  onSubmit?: (value: number) => void;
}

const KEYBOARD_KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['00', '0', 'delete'],
];

export function AmountInput({
  value,
  onChange,
  currencySymbol = '',
  currencyCode = '',
  maxAmount = 10000000,
  minAmount = 0,
  placeholder = '0',
  className,
  onSubmit,
}: AmountInputProps) {
  const { trigger } = useHaptics();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [displayValue, setDisplayValue] = useState(value > 0 ? value.toString() : '');
  const inputRef = useRef<HTMLButtonElement>(null);

  // Sync display value with external value
  useEffect(() => {
    setDisplayValue(value > 0 ? value.toString() : '');
  }, [value]);

  const handleInputFocus = useCallback(() => {
    setIsKeyboardOpen(true);
    trigger('light');
  }, [trigger]);

  const handleKeyPress = useCallback(
    (key: string) => {
      trigger('light');

      if (key === 'delete') {
        const newValue = displayValue.slice(0, -1);
        setDisplayValue(newValue);
        onChange(newValue ? parseInt(newValue, 10) : 0);
        return;
      }

      // Add digit
      const newDisplayValue = displayValue + key;
      const numValue = parseInt(newDisplayValue, 10);

      // Validate against max
      if (numValue > maxAmount) {
        trigger('error');
        return;
      }

      setDisplayValue(newDisplayValue);
      onChange(numValue);
    },
    [displayValue, maxAmount, onChange, trigger]
  );

  const handleConfirm = useCallback(() => {
    const numValue = displayValue ? parseInt(displayValue, 10) : 0;
    
    if (numValue < minAmount) {
      trigger('error');
      return;
    }

    trigger('success');
    setIsKeyboardOpen(false);
    onSubmit?.(numValue);
  }, [displayValue, minAmount, onSubmit, trigger]);

  const handleDismiss = useCallback(() => {
    setIsKeyboardOpen(false);
    trigger('light');
  }, [trigger]);

  const formattedValue = displayValue
    ? parseInt(displayValue, 10).toLocaleString()
    : placeholder;

  return (
    <div className={cn('relative', className)}>
      {/* Amount Display */}
      <button
        ref={inputRef}
        type="button"
        onClick={handleInputFocus}
        className={cn(
          'w-full text-center py-8 px-4',
          'bg-card border-2 rounded-3xl transition-all',
          isKeyboardOpen
            ? 'border-primary ring-4 ring-primary/10'
            : 'border-border hover:border-primary/50'
        )}
      >
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground font-medium">
            Enter Amount
          </p>
          <div className="flex items-baseline justify-center gap-2">
            {currencySymbol && (
              <span className="text-2xl text-muted-foreground">
                {currencySymbol}
              </span>
            )}
            <span
              className={cn(
                'text-5xl font-bold tabular-nums transition-colors',
                displayValue ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {formattedValue}
            </span>
            {currencyCode && (
              <span className="text-xl text-muted-foreground ml-1">
                {currencyCode}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Dynamic Keyboard */}
      <AnimatePresence>
        {isKeyboardOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 z-40"
              onClick={handleDismiss}
            />

            {/* Keyboard Panel */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-50',
                'bg-card border-t-2 border-border',
                'rounded-t-3xl shadow-2xl',
                'safe-area-inset-bottom'
              )}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
              </div>

              {/* Amount Preview */}
              <div className="px-6 py-4 border-b border-border">
                <div className="flex items-baseline justify-center gap-2">
                  {currencySymbol && (
                    <span className="text-xl text-muted-foreground">
                      {currencySymbol}
                    </span>
                  )}
                  <span className="text-4xl font-bold tabular-nums">
                    {formattedValue}
                  </span>
                  {currencyCode && (
                    <span className="text-lg text-muted-foreground ml-1">
                      {currencyCode}
                    </span>
                  )}
                </div>
              </div>

              {/* Keyboard Grid */}
              <div className="p-4 pb-6 grid gap-3">
                {KEYBOARD_KEYS.map((row, rowIndex) => (
                  <div key={rowIndex} className="grid grid-cols-3 gap-3">
                    {row.map((key) => (
                      <motion.button
                        key={key}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleKeyPress(key)}
                        className={cn(
                          'h-16 rounded-2xl font-bold text-2xl',
                          'bg-accent hover:bg-accent/80 transition-colors',
                          'flex items-center justify-center',
                          'active:bg-accent/60'
                        )}
                      >
                        {key === 'delete' ? (
                          <Delete className="w-6 h-6" />
                        ) : (
                          key
                        )}
                      </motion.button>
                    ))}
                  </div>
                ))}

                {/* Confirm Button */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleConfirm}
                  disabled={!displayValue || parseInt(displayValue, 10) < minAmount}
                  className={cn(
                    'h-16 rounded-2xl font-semibold text-lg',
                    'bg-primary text-primary-foreground',
                    'flex items-center justify-center gap-2',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    'transition-all'
                  )}
                >
                  <Check className="w-5 h-5" />
                  Confirm
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

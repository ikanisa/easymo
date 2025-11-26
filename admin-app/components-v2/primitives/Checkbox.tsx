/**
 * Aurora Checkbox Component
 * Multi-select input with animation
 */

'use client';

import { forwardRef } from 'react';
import { Check, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  error?: string;
  className?: string;
}

export const Checkbox = forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ checked = false, indeterminate = false, onChange, disabled, label, description, error, className }, ref) => {
    return (
      <div className={cn('flex items-start gap-3', className)}>
        <button
          ref={ref}
          type="button"
          role="checkbox"
          aria-checked={indeterminate ? 'mixed' : checked}
          disabled={disabled}
          onClick={() => onChange?.(!checked)}
          className={cn(
            'relative flex items-center justify-center w-5 h-5 rounded-md',
            'border-2 transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-[var(--aurora-accent)]/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            checked || indeterminate
              ? 'bg-[var(--aurora-accent)] border-[var(--aurora-accent)]'
              : 'bg-[var(--aurora-surface)] border-[var(--aurora-border)] hover:border-[var(--aurora-accent)]',
            error && 'border-[var(--aurora-error)]'
          )}
        >
          <AnimatePresence>
            {(checked || indeterminate) && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              >
                {indeterminate ? (
                  <Minus className="w-3 h-3 text-white" strokeWidth={3} />
                ) : (
                  <Check className="w-3 h-3 text-white" strokeWidth={3} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {(label || description || error) && (
          <div className="flex-1">
            {label && (
              <label className="block text-sm font-medium text-[var(--aurora-text-primary)] cursor-pointer">
                {label}
              </label>
            )}
            {description && (
              <p className="mt-0.5 text-xs text-[var(--aurora-text-muted)]">
                {description}
              </p>
            )}
            {error && (
              <p className="mt-0.5 text-xs text-[var(--aurora-error)]">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

/**
 * Aurora Toggle/Switch Component
 * Boolean input with smooth animation
 */

'use client';

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface ToggleProps {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ checked = false, onChange, disabled, label, description, size = 'md', className }, ref) => {
    const sizes = {
      sm: { container: 'w-9 h-5', thumb: 'w-3.5 h-3.5', translate: 'translate-x-4' },
      md: { container: 'w-11 h-6', thumb: 'w-4 h-4', translate: 'translate-x-5' },
      lg: { container: 'w-14 h-7', thumb: 'w-5 h-5', translate: 'translate-x-7' },
    };

    const { container, thumb, translate } = sizes[size];

    return (
      <div className={cn('flex items-start gap-3', className)}>
        <button
          ref={ref}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange?.(!checked)}
          className={cn(
            'relative inline-flex flex-shrink-0 rounded-full transition-colors duration-200',
            'focus:outline-none focus:ring-2 focus:ring-[var(--aurora-accent)]/20',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            container,
            checked ? 'bg-[var(--aurora-accent)]' : 'bg-[var(--aurora-surface-muted)] border border-[var(--aurora-border)]'
          )}
        >
          <motion.span
            className={cn(
              'inline-block rounded-full bg-white shadow-sm',
              thumb
            )}
            animate={{
              x: checked ? translate.replace('translate-x-', '') : '2px',
            }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>

        {(label || description) && (
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
          </div>
        )}
      </div>
    );
  }
);

Toggle.displayName = 'Toggle';

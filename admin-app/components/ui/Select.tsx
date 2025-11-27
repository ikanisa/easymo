/**
 * Aurora Select Component
 * Dropdown select with clean styling
 */

'use client';

import { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  helperText?: string;
  options: Array<{ value: string; label: string }>;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options, disabled, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--aurora-text-primary)] mb-2">
            {label}
          </label>
        )}

        <div className="relative">
          <select
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full h-10 px-3 pr-10 rounded-lg appearance-none',
              'bg-[var(--aurora-surface)] border border-[var(--aurora-border)]',
              'text-[var(--aurora-text-primary)] text-sm',
              'focus:outline-none focus:ring-2 focus:ring-[var(--aurora-accent)]/20',
              'focus:border-[var(--aurora-accent)]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-[var(--aurora-error)] focus:ring-[var(--aurora-error)]/20',
              className
            )}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--aurora-text-muted)] pointer-events-none" />
        </div>

        {(error || helperText) && (
          <p className={cn(
            'mt-1.5 text-xs',
            error ? 'text-[var(--aurora-error)]' : 'text-[var(--aurora-text-muted)]'
          )}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

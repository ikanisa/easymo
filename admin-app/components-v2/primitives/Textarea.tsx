/**
 * Aurora Textarea Component
 * Multi-line text input
 */

'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, resize = 'vertical', disabled, ...props }, ref) => {
    const resizeClasses = {
      none: 'resize-none',
      vertical: 'resize-y',
      horizontal: 'resize-x',
      both: 'resize',
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--aurora-text-primary)] mb-2">
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          disabled={disabled}
          className={cn(
            'w-full min-h-[100px] px-3 py-2 rounded-lg',
            'bg-[var(--aurora-surface)] border border-[var(--aurora-border)]',
            'text-[var(--aurora-text-primary)] text-sm',
            'placeholder:text-[var(--aurora-text-muted)]',
            'focus:outline-none focus:ring-2 focus:ring-[var(--aurora-accent)]/20',
            'focus:border-[var(--aurora-accent)]',
            'transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[var(--aurora-error)] focus:ring-[var(--aurora-error)]/20',
            resizeClasses[resize],
            className
          )}
          {...props}
        />

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

Textarea.displayName = 'Textarea';

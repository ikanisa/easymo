/**
 * Aurora Input Component
 * Clean, accessible text input with validation states
 */

'use client';

import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-[var(--aurora-text-primary)] mb-2">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-muted)]">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            disabled={disabled}
            className={cn(
              'w-full h-10 px-3 rounded-lg',
              'bg-[var(--aurora-surface)] border border-[var(--aurora-border)]',
              'text-[var(--aurora-text-primary)] text-sm',
              'placeholder:text-[var(--aurora-text-muted)]',
              'focus:outline-none focus:ring-2 focus:ring-[var(--aurora-accent)]/20',
              'focus:border-[var(--aurora-accent)]',
              'transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-[var(--aurora-error)] focus:ring-[var(--aurora-error)]/20',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              className
            )}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--aurora-text-muted)]">
              {rightIcon}
            </div>
          )}
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

Input.displayName = 'Input';

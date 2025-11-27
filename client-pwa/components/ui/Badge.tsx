import { cn } from '@/lib/utils';
import { HTMLAttributes } from 'react';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

export function Badge({
  className,
  variant = 'default',
  size = 'md',
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium rounded-full',
        {
          'bg-secondary text-secondary-foreground': variant === 'default',
          'bg-primary text-primary-foreground': variant === 'primary',
          'bg-green-500/10 text-green-500 border border-green-500/20':
            variant === 'success',
          'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20':
            variant === 'warning',
          'bg-red-500/10 text-red-500 border border-red-500/20':
            variant === 'error',
          'border border-border text-foreground bg-transparent':
            variant === 'outline',
        },
        {
          'px-2 py-0.5 text-xs': size === 'sm',
          'px-2.5 py-1 text-sm': size === 'md',
          'px-3 py-1.5 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    />
  );
}

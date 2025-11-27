import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', fullWidth, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={clsx(
          'inline-flex items-center justify-center rounded-xl font-medium transition-all',
          'active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
          'touch-manipulation tap-highlight-none',
          {
            // Variants
            'bg-primary text-primary-foreground hover:bg-primary/90 shadow-glow':
              variant === 'primary',
            'bg-secondary text-secondary-foreground hover:bg-secondary/80':
              variant === 'secondary',
            'border-2 border-border bg-transparent hover:bg-accent':
              variant === 'outline',
            'bg-transparent hover:bg-accent': variant === 'ghost',
            'bg-destructive text-destructive-foreground hover:bg-destructive/90':
              variant === 'destructive',

            // Sizes
            'px-3 py-1.5 text-sm min-h-[36px]': size === 'sm',
            'px-4 py-2 text-base min-h-[44px]': size === 'md',
            'px-6 py-3 text-lg min-h-[52px]': size === 'lg',

            // Full width
            'w-full': fullWidth,
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

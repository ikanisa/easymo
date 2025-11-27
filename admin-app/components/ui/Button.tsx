/**
 * Aurora Button Component
 * World-class button with fluid animations and variants
 */

'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  `inline-flex items-center justify-center gap-2
   font-medium transition-all duration-200
   focus-visible:outline-none focus-visible:ring-2 
   focus-visible:ring-[var(--aurora-accent)] focus-visible:ring-offset-2
   disabled:pointer-events-none disabled:opacity-50
   active:scale-[0.98]`,
  {
    variants: {
      variant: {
        primary: `bg-[var(--aurora-accent)] text-white hover:bg-[var(--aurora-accent-hover)] shadow-sm hover:shadow-md`,
        secondary: `bg-[var(--aurora-surface)] text-[var(--aurora-text-primary)] border border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-elevated)]`,
        ghost: `text-[var(--aurora-text-secondary)] hover:bg-[var(--aurora-surface-elevated)] hover:text-[var(--aurora-text-primary)]`,
        danger: `bg-[var(--aurora-error)] text-white hover:bg-[var(--aurora-error)]/90 shadow-sm`,
        success: `bg-[var(--aurora-success)] text-white hover:bg-[var(--aurora-success)]/90 shadow-sm`,
        // Backward compatibility
        outline: `bg-[var(--aurora-surface)] text-[var(--aurora-text-primary)] border border-[var(--aurora-border)] hover:bg-[var(--aurora-surface-elevated)]`,
        default: `bg-[var(--aurora-accent)] text-white hover:bg-[var(--aurora-accent-hover)] shadow-sm hover:shadow-md`,
        destructive: `bg-[var(--aurora-error)] text-white hover:bg-[var(--aurora-error)]/90 shadow-sm`,
        link: `text-[var(--aurora-accent)] hover:underline underline-offset-4`,
      },
      size: {
        sm: 'h-8 px-3 text-sm rounded-lg',
        md: 'h-10 px-4 text-sm rounded-lg',
        lg: 'h-12 px-6 text-base rounded-xl',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      loading,
      leftIcon,
      rightIcon,
      children,
      disabled,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

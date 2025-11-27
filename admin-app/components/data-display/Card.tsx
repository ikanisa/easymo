/**
 * Aurora Card Component
 * Versatile container with glass effect option
 */

'use client';

import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  glass?: boolean;
  hover?: boolean;
}

export function Card({ 
  children, 
  className, 
  glass = false, 
  hover = false,
  ...props 
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-6',
        glass 
          ? 'glass-surface' 
          : 'bg-[var(--aurora-surface)] border-[var(--aurora-border)]',
        hover && 'transition-all duration-300 hover:shadow-lg hover:border-[var(--aurora-accent)]/20',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center justify-between mb-4', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 
      className={cn('text-lg font-semibold text-[var(--aurora-text-primary)]', className)} 
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p 
      className={cn('text-sm text-[var(--aurora-text-secondary)]', className)} 
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ 
  children, 
  className,
  ...props 
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex items-center gap-2 mt-6', className)} {...props}>
      {children}
    </div>
  );
}

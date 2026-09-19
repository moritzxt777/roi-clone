'use client';

import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'border-transparent bg-[rgb(var(--color-primary))] text-[rgb(var(--color-primary-foreground))] hover:bg-[rgb(var(--color-primary))]/80',
      secondary: 'border-transparent bg-[rgb(var(--color-secondary))] text-[rgb(var(--color-secondary-foreground))] hover:bg-[rgb(var(--color-secondary))]/80',
      destructive: 'border-transparent bg-[rgb(var(--color-destructive))] text-[rgb(var(--color-destructive-foreground))] hover:bg-[rgb(var(--color-destructive))]/80',
      outline: 'text-[rgb(var(--color-foreground))] border border-[rgb(var(--color-border))]',
      success: 'border-transparent bg-green-500 text-white hover:bg-green-600',
      warning: 'border-transparent bg-yellow-500 text-white hover:bg-yellow-600',
    };

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-ring))] focus:ring-offset-2',
          variants[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';
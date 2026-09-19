'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'default', asChild = false, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50';
    
    const variants = {
      primary: 'bg-[rgb(var(--color-primary))] text-[rgb(var(--color-primary-foreground))] hover:bg-[rgb(var(--color-primary))]/90',
      secondary: 'bg-[rgb(var(--color-secondary))] text-[rgb(var(--color-secondary-foreground))] hover:bg-[rgb(var(--color-secondary))]/80',
      outline: 'border border-[rgb(var(--color-input))] bg-[rgb(var(--color-background))] hover:bg-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent-foreground))]',
      ghost: 'hover:bg-[rgb(var(--color-accent))] hover:text-[rgb(var(--color-accent-foreground))]',
      destructive: 'bg-[rgb(var(--color-destructive))] text-[rgb(var(--color-destructive-foreground))] hover:bg-[rgb(var(--color-destructive))]/90',
    };

    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-9 rounded-md px-3',
      lg: 'h-11 rounded-md px-8',
      icon: 'h-10 w-10',
    };

    const Component = asChild ? 'span' : 'button';
    
    return (
      <Component
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';
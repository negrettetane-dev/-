import React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variant === 'default' && 'bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:shadow-md active:translate-y-px',
        variant === 'outline' && 'border border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700',
        variant === 'ghost' && 'border-0 bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900',
        size === 'default' && 'h-11 px-5',
        size === 'sm' && 'h-9 rounded-lg px-3',
        size === 'icon' && 'h-10 w-10 p-0',
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';

import React from 'react';
import { cn } from '../../lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        'h-12 w-full appearance-none rounded-2xl border border-solid border-slate-300 bg-slate-50/80 px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';

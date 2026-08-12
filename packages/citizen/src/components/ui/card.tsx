import React from 'react';
import { cn } from '../../lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-3xl border border-white/70 bg-white shadow-auth', className)} {...props} />
  ),
);

Card.displayName = 'Card';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'neutral' | 'brand' | 'accent' | 'outline' | 'success' | 'danger';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-surface text-black dark:bg-slate-800 dark:text-slate-200',
  brand: 'bg-brand-soft text-brand-strong dark:bg-brand/15 dark:text-brand-accent',
  accent: 'bg-brand text-white',
  outline:
    'border border-line bg-white text-black dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200',
  success: 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400',
};

export default function Badge({
  children,
  variant = 'neutral',
  className,
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold leading-none',
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}

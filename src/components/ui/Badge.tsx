import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant = 'neutral' | 'brand' | 'accent' | 'outline' | 'success' | 'danger';

const VARIANTS: Record<BadgeVariant, string> = {
  neutral: 'bg-surface text-ink-soft',
  brand: 'bg-brand-soft text-brand-strong',
  accent: 'bg-brand text-white',
  outline: 'border border-line bg-white text-muted',
  success: 'bg-green-50 text-green-700',
  danger: 'bg-red-50 text-red-700',
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

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export default function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-dashed border-line bg-surface px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900',
        className,
      )}
    >
      {icon ? (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white text-black shadow-card dark:bg-slate-800 dark:text-slate-200">
          {icon}
        </div>
      ) : null}
      <h3 className="font-display text-lg font-bold text-black dark:text-white">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-black dark:text-white">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

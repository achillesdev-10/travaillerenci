import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function SectionHeader({
  kicker,
  title,
  description,
  actionHref,
  actionLabel,
  titleAs: Heading = 'h2',
  className,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
  titleAs?: 'h1' | 'h2' | 'h3';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
        className,
      )}
    >
      <div className="max-w-2xl">
        {kicker ? (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            {kicker}
          </p>
        ) : null}
        <Heading className="font-display text-xl font-bold tracking-tight text-black dark:text-white sm:text-2xl">
          {title}
        </Heading>
        {description ? (
          <p className="mt-2 text-sm leading-relaxed text-black dark:text-white sm:text-base">
            {description}
          </p>
        ) : null}
      </div>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-brand transition-colors hover:text-brand-strong dark:text-brand-accent dark:hover:text-white"
        >
          {actionLabel}
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

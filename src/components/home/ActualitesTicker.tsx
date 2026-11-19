import Link from 'next/link';

export interface ActualiteTickerItem {
  id: string;
  title: string;
  href: string;
  category?: string;
}

/**
 * Bandeau défilant des dernières actualités (Server Component).
 * Chaque titre renvoie vers la page de l'actualité correspondante.
 */
export default function ActualitesTicker({ items }: { items: ActualiteTickerItem[] }) {
  if (items.length === 0) return null;

  const row = (copy: boolean) => (
    <div
      className="flex shrink-0 items-center gap-6 pl-6 sm:gap-10 sm:pl-10"
      aria-hidden={copy || undefined}
      inert={copy || undefined}
    >
      {items.map((item) => (
        <Link
          key={`${item.id}${copy ? '-copy' : ''}`}
          href={item.href}
          className="group flex items-center gap-2 text-[12px] text-slate-700 transition-colors hover:text-orange-600 sm:text-[13px] dark:text-slate-300 dark:hover:text-orange-400"
        >
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-500" aria-hidden="true" />
          {item.category ? (
            <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-orange-600 dark:text-orange-400">
              {item.category}
            </span>
          ) : null}
          <span className="max-w-[260px] truncate group-hover:underline group-hover:underline-offset-2 sm:max-w-md">
            {item.title}
          </span>
        </Link>
      ))}
    </div>
  );

  return (
    <div className="border-b border-line bg-orange-50/70 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-4">
        <Link
          href="/actualites"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-orange-600 transition-colors"
        >
          <span className="h-1.5 w-1.5 animate-ticker-pulse rounded-full bg-white" aria-hidden="true" />
          Actualités
        </Link>
        <div className="relative flex-1 overflow-hidden">
          <div className="animate-marquee flex w-max">
            {row(false)}
            {row(true)}
          </div>
        </div>
        <Link
          href="/actualites"
          className="hidden shrink-0 items-center gap-1 text-[11px] font-semibold text-orange-600 hover:underline sm:inline-flex dark:text-orange-400"
        >
          Tout voir
        </Link>
      </div>
    </div>
  );
}

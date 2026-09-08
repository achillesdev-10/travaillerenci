import Link from 'next/link';

export interface TickerItem {
  id: string;
  title: string;
  href: string;
  type: 'offre' | 'concours' | 'bourse' | 'blog';
}

const TYPE_META: Record<TickerItem['type'], { label: string; className: string }> = {
  offre: { label: 'Offre', className: 'bg-orange-500/20 text-orange-300' },
  concours: { label: 'Concours', className: 'bg-emerald-500/20 text-emerald-300' },
  bourse: { label: 'Bourse', className: 'bg-sky-500/20 text-sky-300' },
  blog: { label: 'Blog', className: 'bg-amber-500/20 text-amber-300' },
};

function TickerLink({ item }: { item: TickerItem }) {
  const meta = TYPE_META[item.type];
  return (
    <Link
      href={item.href}
      className="group flex min-w-0 items-center gap-2.5 text-sm text-gray-100 hover:text-white"
    >
      <span
        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.className}`}
      >
        {meta.label}
      </span>
      <span className="truncate max-w-[240px] sm:max-w-sm group-hover:underline underline-offset-2">
        {item.title}
      </span>
      <span className="ml-2 shrink-0 text-orange-400 transition-transform group-hover:translate-x-1" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

/**
 * Fil d'actualité défilant (marquee CSS pur — Server Component).
 *
 * La boucle CSS translateX(-50%) nécessite le contenu en double dans le DOM :
 * la seconde moitié est aria-hidden + `inert` pour ne pas créer de liens
 * dupliqués focusables (audit accessibilité Lighthouse).
 */
export default function NewsTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="relative z-10 overflow-hidden border-y border-white/10 bg-slate-900">
      <div className="flex items-stretch">
        <div className="relative z-10 flex shrink-0 items-center gap-2 bg-orange-700 px-3.5 sm:px-5 text-white shadow-lg">
          <span className="relative flex h-2 w-2">
            <span className="animate-ticker-pulse absolute inline-flex h-full w-full rounded-full bg-white" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
          </span>
          <span className="text-[11px] sm:text-xs font-extrabold uppercase tracking-wider whitespace-nowrap">
            En direct
          </span>
        </div>
        <div className="relative flex flex-1 items-center overflow-hidden py-2.5">
          <div className="animate-marquee flex w-max">
            <div className="flex shrink-0 items-center gap-10 pl-10" aria-label="Actualités récentes">
              {items.map((item) => (
                <TickerLink key={`${item.type}-${item.id}`} item={item} />
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-10 pl-10" aria-hidden="true" inert>
              {items.map((item) => (
                <TickerLink key={`${item.type}-${item.id}-copy`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
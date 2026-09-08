import Link from 'next/link';
import type { JobOfferSchema } from '@/types';

interface ScrollingOffersProps {
  offers: JobOfferSchema[];
}

function contractBadge(type?: string | null) {
  if (!type) return null;
  const colors: Record<string, string> = {
    CDI: 'bg-emerald-100 text-emerald-700',
    CDD: 'bg-orange-100 text-orange-700',
    Stage: 'bg-sky-100 text-sky-700',
    Alternance: 'bg-purple-100 text-purple-700',
    Freelance: 'bg-rose-100 text-rose-700',
    'Temps partiel': 'bg-amber-100 text-amber-700',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  );
}

function OfferCard({ offer }: { offer: JobOfferSchema }) {
  return (
    <Link
      href={`/jobs/${offer.id}`}
      prefetch={false}
      className="shrink-0 w-[280px] sm:w-[320px] rounded-2xl border border-gray-100 bg-white shadow-md hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 p-4 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-[13px] font-bold text-black dark:text-white leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {offer.title}
        </h3>
        {contractBadge(offer.contract_type)}
      </div>
      <p className="text-[11px] text-gray-700 dark:text-gray-400 mb-2 line-clamp-1">
        {offer.company || 'Entreprise'}
      </p>
      <div className="flex items-center gap-2 text-[10px] text-gray-600 dark:text-gray-500">
        {offer.location && (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {offer.location}
          </span>
        )}
      </div>
    </Link>
  );
}

/**
 * Défilant d'offres horizontal.
 *
 * Server Component + animation CSS pure (transform) : plus aucune boucle
 * requestAnimationFrame qui écrivait `el.scrollLeft` à chaque frame
 * (forced reflow permanent, travail main-thread inutile). Le CSS
 * `animate-marquee` (défini dans globals.css) translate la rangée doublée.
 * La seconde moitié (copie invisible pour la boucle) est aria-hidden et
 * rendue non focusable pour éviter les liens dupliqués dans l'arbre
 * d'accessibilité.
 */
export default function ScrollingOffers({ offers }: ScrollingOffersProps) {
  if (!offers.length) return null;

  const doubled = [...offers, ...offers];

  return (
    <div className="relative overflow-hidden group/scroller">
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-gray-50 to-transparent dark:from-slate-950 z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-gray-50 to-transparent dark:from-slate-950 z-10" />

      <div
        className="flex w-max gap-4 overflow-hidden py-2 animate-marquee group-hover/scroller:[animation-play-state:paused]"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {doubled.map((offer, i) => {
          const isCopy = i >= offers.length;
          // `inert` + aria-hidden sur la copie : la boucle CSS a besoin des
          // éléments en double dans le DOM, mais ils ne doivent ni être
          // focusables ni apparaître dans l'arbre d'accessibilité.
          return (
            <div key={`${offer.id}-${i}`} aria-hidden={isCopy || undefined} inert={isCopy || undefined}>
              <OfferCard offer={offer} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
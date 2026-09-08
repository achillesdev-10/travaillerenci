'use client';

import dynamic from 'next/dynamic';

function PollWidgetSkeleton() {
  return (
    <section
      aria-label="Sondage"
      className="rounded-2xl sm:rounded-3xl border border-orange-100 bg-white p-5 sm:p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800"
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl bg-orange-500/20 animate-pulse" />
        <div className="space-y-1.5">
          <div className="h-4 w-20 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-3 w-28 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
        </div>
      </div>
      <div className="space-y-2.5">
        <div className="h-4 w-3/4 bg-gray-100 dark:bg-slate-800 rounded animate-pulse" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
        ))}
      </div>
    </section>
  );
}

/**
 * Sondage — chargé après hydratation uniquement (ssr:false) :
 * sous la ligne de flottaison et données récupérées côté client de toute
 * façon. Son JS/CSS sort du bundle initial de la home ; le squelette rendu
 * en SSR garde la hauteur (zéro CLS).
 */
export default dynamic(() => import('./PollWidget'), {
  ssr: false,
  loading: () => <PollWidgetSkeleton />,
});
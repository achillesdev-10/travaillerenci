'use client';

import { useState } from 'react';
import Link from 'next/link';
import CompactJobCard from '@/components/home/CompactJobCard';
import type { JobOfferSchema } from '@/types';

// 12 offres initiales au lieu de 20 : réduit le DOM de la grille sans
// changer l'UX (bouton « Voir plus » présent).
const PAGE_SIZE = 12;

export default function OffersGrid({ jobs }: { jobs: JobOfferSchema[] }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const shown = jobs.slice(0, visible);
  const hasMore = jobs.length > visible;

  return (
    <>
      <ul className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 list-none p-0 m-0">
        {shown.map((job) => (
          <li key={job.id} className="h-full">
            <CompactJobCard job={job} />
          </li>
        ))}
      </ul>

      <div className="mt-8 sm:mt-12 flex flex-col items-center gap-4">
        {hasMore ? (
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-primary text-white font-semibold text-sm sm:text-base shadow-md shadow-primary/20 hover:bg-primary-dark transition-colors"
          >
            Voir plus d'offres
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">
              {jobs.length - visible}
            </span>
          </button>
        ) : null}
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 px-5 sm:px-6 py-3 rounded-xl bg-white dark:bg-slate-900 border border-border hover:border-primary/30 hover:shadow-sm text-gray-800 dark:text-gray-200 hover:text-primary font-semibold text-sm sm:text-base transition-colors"
        >
          Voir toutes les offres
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
    </>
  );
}

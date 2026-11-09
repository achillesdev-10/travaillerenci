'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

interface JobExpiryBannerProps {
  /** Drapeau BDD (géré côté admin / scraper) : expiration déclarée. */
  isExpired: boolean;
  /** Date limite de candidature brute (string) ou null. */
  deadline: string | null;
}

/**
 *  TravaillerEnCI — JobExpiryBanner
 *
 *  Bannière « Offre expirée » pilotée CÔTÉ CLIENT.
 *
 *  Pourquoi ici et plus au serveur : /jobs/[id] est ISR 24 h — un rendu
 *  serveur gèlerait la comparaison `deadline < Date.now()` jusqu'à la
 *  prochaine revalidation, et une offre pourrait rester affichée «
 *  ouverte » pendant une journée. Ce composant recalcul après hydratation
 *  (aucune incohérence de rendu : l'état initial serveur est le drapeau
 *  BDD, la correction visuelle arrive après le montage), et programme
 *  l'apparition de la bannière quand la date limite passe pendant que
 *  l'onglet reste ouvert (délai ≤ 24 h).
 */
export default function JobExpiryBanner({ isExpired, deadline }: JobExpiryBannerProps) {
  const [expired, setExpired] = useState(isExpired);

  useEffect(() => {
    // Expiration déclarée en base : rien à corriger, le rendu est juste.
    if (isExpired) return;

    const deadlineTime = deadline ? new Date(deadline).getTime() : NaN;
    if (Number.isNaN(deadlineTime)) return;

    // Date limite déjà passée au montage → correction immédiate après
    // hydratation (timer à 0, jamais de setState synchrone dans l'effet) ;
    // sinon apparition programmée quand la limite passera (≤ 24 h, au-delà
    // la navigation suivante relancera l'effet).
    const DAY_MS = 24 * 60 * 60 * 1000;
    const remainingMs = deadlineTime - Date.now();
    if (remainingMs > DAY_MS) return;
    const delay = Math.max(remainingMs, 0);
    const timer = setTimeout(() => {
      setExpired(true);
    }, delay + 1000);
    return () => clearTimeout(timer);
  }, [isExpired, deadline]);

  if (!expired) return null;

  return (
    <div className="bg-rose-600 text-white">
      <div className="container mx-auto max-w-4xl px-4 py-3 flex items-center gap-3 text-sm font-semibold">
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
        Offre expirée
        {deadline
          ? ` — la date limite de candidature (${formatDate(deadline)}) est dépassée.`
          : ' — la date limite de candidature est dépassée.'}
      </div>
    </div>
  );
}

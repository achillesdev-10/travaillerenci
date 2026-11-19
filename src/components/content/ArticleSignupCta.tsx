'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchCurrentUser } from '@/lib/clientAuth';
import { trackEvent } from '@/lib/analyticsClient';

/**
 * Appel à l'action de fin d'article. Rendu côté serveur (visible dans le HTML
 * initial) puis masqué pour les visiteurs déjà connectés.
 */
export default function ArticleSignupCta({ nextPath }: { nextPath: string }) {
  const [isGuest, setIsGuest] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) setIsGuest(!current);
      })
      .catch(() => {
        if (!cancelled) setIsGuest(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isGuest === false) return null;

  return (
    <aside className="mt-8 rounded-2xl border border-brand/25 bg-brand-soft/60 p-5 dark:border-brand/30 dark:bg-brand/10">
      <h2 className="font-[var(--font-display)] text-lg font-bold text-black dark:text-white">
        Ne ratez pas les prochaines opportunités
      </h2>
      <p className="mt-1 text-sm text-black/75 dark:text-slate-300">
        Créez un compte gratuit pour enregistrer les offres et recevoir des alertes
        correspondant à votre profil.
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <Link
          href={`/register?next=${encodeURIComponent(nextPath)}`}
          onClick={() => trackEvent('cta_click', { label: 'article_end' })}
          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
        >
          Créer mon compte gratuitement
        </Link>
        <Link
          href="/jobs"
          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold text-black transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
        >
          Voir les offres
        </Link>
      </div>
    </aside>
  );
}

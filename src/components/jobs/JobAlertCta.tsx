'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { fetchCurrentUser } from '@/lib/clientAuth';
import { trackEvent } from '@/lib/analyticsClient';

export default function JobAlertCta() {
  const [isGuest, setIsGuest] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) setIsGuest(!current);
      })
      .catch(() => {
        if (!cancelled) setIsGuest(true);
      })
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!checked) return null;

  const href = isGuest
    ? `/register?next=${encodeURIComponent('/dashboard/candidate')}`
    : '/dashboard/candidate#alertes';

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-brand/25 bg-brand-soft/60 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-brand/30 dark:bg-brand/10">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm dark:bg-slate-900 dark:text-brand-accent">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-bold text-ink dark:text-white">
            Créez une alerte pour cette recherche
          </p>
          <p className="mt-0.5 text-[13px] text-ink-soft dark:text-slate-300">
            Recevez les nouvelles offres qui correspondent à vos critères.
          </p>
        </div>
      </div>
      <Link
        href={href}
        onClick={() => trackEvent('cta_click', { label: 'jobs_list_alert' })}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
      >
        Créer mon alerte
      </Link>
    </div>
  );
}

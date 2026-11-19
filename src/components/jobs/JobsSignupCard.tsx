'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analyticsClient';

interface JobsSignupCardProps {
  nextPath?: string;
}

export default function JobsSignupCard({ nextPath = '/jobs' }: JobsSignupCardProps) {
  return (
    <aside className="col-span-2 flex flex-col justify-center rounded-2xl border border-brand/25 bg-brand-soft/60 p-5 sm:col-span-1 dark:border-brand/30 dark:bg-brand/10">
      <p className="font-[var(--font-display)] text-base font-bold text-ink dark:text-white">
        Créez votre compte gratuit
      </p>
      <p className="mt-1 text-sm text-ink-soft dark:text-slate-300">
        Enregistrez vos offres préférées et recevez les nouvelles opportunités par alerte.
      </p>
      <Link
        href={`/register?next=${encodeURIComponent(nextPath)}`}
        onClick={() => trackEvent('cta_click', { label: 'jobs_list_signup' })}
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
      >
        S’inscrire gratuitement
      </Link>
    </aside>
  );
}

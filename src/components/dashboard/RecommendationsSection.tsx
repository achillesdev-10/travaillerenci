'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { JobOfferSchema } from '@/types';
import CompactJobCard from '@/components/home/CompactJobCard';

/** Offre recommandée : offre + score et raisons du scoring (§10). */
type RecommendedJob = JobOfferSchema & {
  recommendation?: { score: number; reasons: string[] };
};

interface RecommendationsResponse {
  total: number;
  isFallback: boolean;
  profilePersonalized: boolean;
  jobs: RecommendedJob[];
}

/**
 * Section « 🎯 Offres recommandées pour vous » du dashboard candidat.
 * Les recommandations sont calculées côté serveur (/api/recommendations) à
 * partir du profil candidat — aucun score n'est exposé côté client au-delà
 * du nécessaire.
 */
export default function RecommendationsSection() {
  const [data, setData] = useState<RecommendationsResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/recommendations?limit=6', { cache: 'no-store' });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const json = (await res.json()) as RecommendationsResponse;
      setData({
        total: Number(json.total) || 0,
        isFallback: Boolean(json.isFallback),
        profilePersonalized: Boolean(json.profilePersonalized),
        jobs: Array.isArray(json.jobs) ? json.jobs : [],
      });
    } catch {
      setFailed(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const jobs = data?.jobs ?? [];
  const personalized = data?.profilePersonalized ?? false;

  return (
    <section
      aria-label="Offres recommandées pour vous"
      className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold font-[var(--font-display)] text-gray-900 dark:text-white">
            🎯 Offres recommandées pour vous
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-xl">
            {!loaded
              ? 'Analyse de votre profil…'
              : personalized
                ? jobs.length > 0
                  ? `${jobs.length} offre${jobs.length > 1 ? 's' : ''} correspond${jobs.length > 1 ? 'ent' : ''} à votre profil.`
                  : 'Aucune nouvelle offre ne correspond encore à votre profil — revenez bientôt.'
                : 'Ces opportunités récentes pourraient vous intéresser. Complétez votre profil pour des recommandations personnalisées.'}
          </p>
        </div>
        {!personalized && loaded ? (
          <Link
            href="/dashboard/candidate#profil"
            className="shrink-0 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/10 transition-all"
          >
            Compléter mon profil
          </Link>
        ) : null}
      </div>

      {!loaded ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-56 animate-pulse rounded-2xl border border-gray-100 bg-gray-50 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      ) : failed ? (
        <p className="py-6 text-center text-sm text-gray-400">
          Impossible de charger vos recommandations pour le moment.
        </p>
      ) : jobs.length === 0 ? (
        <div className="py-6 text-center">
          <p className="mx-auto mb-5 max-w-md text-sm text-gray-500 dark:text-slate-400">
            Ajoutez votre ville et vos secteurs d&apos;intérêt dans votre profil pour recevoir
            des recommandations pertinentes.
          </p>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-xs font-bold text-white shadow-lg shadow-primary/20 transition-all hover:brightness-110"
          >
            Parcourir les offres
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {jobs.map((job) => (
            <div key={job.id} className="space-y-1.5">
              <CompactJobCard job={job} />
              {personalized && job.recommendation?.reasons?.length ? (
                <ul className="flex flex-wrap gap-1 px-1" aria-label="Raisons de la recommandation">
                  {job.recommendation.reasons.map((reason) => (
                    <li
                      key={reason}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary"
                    >
                      {reason}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

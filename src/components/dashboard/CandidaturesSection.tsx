'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface ApplicationSummary {
  id: string;
  job_id: string;
  candidate_id: string;
  status: 'submitted' | 'reviewing' | 'shortlisted' | 'interview' | 'rejected' | 'hired';
  applied_at: string;
  candidate_name: string | null;
  candidate_avatar: string | null;
  job_title: string | null;
  company_name: string | null;
}

const STATUS_LABELS: Record<ApplicationSummary['status'], string> = {
  submitted: 'Envoyée',
  reviewing: 'En cours d\'examen',
  shortlisted: 'Présélectionné',
  interview: 'Entretien',
  rejected: 'Refusée',
  hired: 'Engagée',
};

const STATUS_COLORS: Record<ApplicationSummary['status'], string> = {
  submitted: 'bg-primary/10 text-primary dark:bg-brand/15 dark:text-brand-accent',
  reviewing: 'bg-orange-500/10 border-orange-500/30 text-orange-400 dark:text-orange-300',
  shortlisted: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 dark:text-emerald-300',
  interview: 'bg-blue-500/10 border-blue-500/30 text-blue-400 dark:text-blue-300',
  rejected: 'bg-rose-500/10 border-rose-500/30 text-rose-400 dark:text-rose-300',
  hired: 'bg-green-500/10 border-green-500/30 text-green-400 dark:text-green-300',
};

const STATUS_ORDER: ApplicationSummary['status'][] = [
  'submitted',
  'reviewing',
  'shortlisted',
  'interview',
  'rejected',
  'hired',
];

export default function CandidaturesSection() {
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/applications', {
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
        setError(null);
      } else {
        const errData = await res.json();
        setError(errData.error || 'Erreur lors du chargement');
      }
    } catch (err) {
      setError('Impossible de charger les candidatures');
      console.error('CandidaturesSection error:', err);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!loaded) {
    return (
      <div className="py-10 text-center text-sm text-black/50">
        Chargement…
      </div>
    );
  }

  // Trier par date (les plus récentes d'abord)
  const sorted = [...applications].sort(
    (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="py-6 text-center">
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-brand-soft text-primary dark:bg-brand/15 dark:text-brand-accent flex items-center justify-center">
          <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v16" />
            <path d="M2 7l1 12a2 2 0 0 0 2 2h4" />
            <path d="M2 7l1 12a2 2 0 0 1 2 2h10" />
            <path d="M6 7h4" />
            <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          </svg>
        </div>
        <p className="text-sm text-black dark:text-white mt-4">
          Aucune candidature pour le moment. Les candidatures apparaîtront ici
          dès que vous postulerez à des offres.
        </p>
      </div>
    );
  }

  // Regrouper par statut pour l'affichage
  const grouped = sorted.reduce(
    (acc, app) => {
      const status = app.status as ApplicationSummary['status'];
      if (!acc[status]) acc[status] = [];
      acc[status].push(app);
      return acc;
    },
    {} as Record<ApplicationSummary['status'], ApplicationSummary[]>
  );

  return (
    <div className="rounded-3xl border border-line dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold font-[var(--font-display)] text-black dark:text-white">
            Mes candidatures
          </h2>
          <p className="text-xs text-black dark:text-white mt-1">
            Suivez l'état de vos candidatures et recevez des notifications
            lorsque l'entreprise apporte une mise à jour.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft text-primary dark:bg-brand/15 dark:text-brand-accent px-3 py-1 text-[11px] font-bold">
          {sorted.length} candidature{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error ? (
        <div className="py-4 text-sm text-rose-500 dark:text-rose-300 mb-4">
          {error}
        </div>
      ) : null}

      <div className="space-y-5">
        {STATUS_ORDER.map((status) => {
          const group = grouped[status] || [];
          if (group.length === 0) return null;

          return (
            <div key={status} className="rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-black dark:text-white">
                  {STATUS_LABELS[status]} {group.length}
                </h3>
              </div>

              <ul className="space-y-3 max-h-80 overflow-y-auto">
                {group.map((app) => (
                  <li
                    key={app.id}
                    className="group flex items-center gap-3 rounded-xl border border-line dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5 sm:p-4 transition-all hover:border-primary/25 hover:shadow-md"
                  >
                    <div className="flex-shrink-0 rounded-2xl bg-gradient-to-br from-primary to-brand-accent w-10 h-10 flex items-center justify-center">
                      <svg
                        className="w-5 h-5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 4.37a4 4 0 0 1 0 3.48m0-4.37a4 4 0 0 1 0-3.48m-12 8a4 4 0 0 1 7.92 0" />
                        <line x1="18" y1="15" x2="18" y2="21" />
                        <line x1="12" y1="9" x2="12" y2="15" />
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[14px] text-black dark:text-white truncate group-hover:text-primary transition-colors">
                        {app.job_title || 'Offre sans titre'}
                      </div>
                      <div className="text-[12px] text-black dark:text-white truncate mt-0.5">
                        {app.company_name || 'Entreprise inconnue'}
                      </div>
                      <div className="text-[11px] text-black/50 mt-1">
                        Envoyée le {formatDate(app.applied_at)}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={true}
                      aria-label="Voir les détails"
                      className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl text-gray-400 dark:text-gray-600 hover:text-primary hover:bg-primary/10 transition-all disabled:opacity-50"
                    >
                      <svg
                        className="w-4.5 h-4.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
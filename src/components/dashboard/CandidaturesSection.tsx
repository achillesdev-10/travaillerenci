'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { cn, formatDate } from '@/lib/utils';
import { trackEvent } from '@/lib/analyticsClient';
import {
  buildJobPath,
  buildMailtoHref,
  normalizeApplyEmail,
  normalizeHttpUrl,
  statusLabel,
  statusTone,
  type ApplicationRecord,
  type CandidateUpdatableStatus,
} from '@/lib/applicationRules';

type Filter = 'all' | 'to_finalize' | 'sent' | 'response_received' | 'closed';

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'Toutes' },
  { value: 'to_finalize', label: 'À finaliser' },
  { value: 'sent', label: 'Envoyées' },
  { value: 'response_received', label: 'Réponses' },
  { value: 'closed', label: 'Clôturées' },
];

function filterGroup(status: string): Filter {
  if (status === 'pending' || status === 'to_finalize') return 'to_finalize';
  if (status === 'submitted' || status === 'sent') return 'sent';
  if (status === 'response_received') return 'response_received';
  if (status === 'closed' || status === 'rejected' || status === 'hired') return 'closed';
  return 'sent';
}

function isFinalizable(status: string): boolean {
  return status === 'to_finalize' || status === 'pending';
}

export default function CandidaturesSection() {
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/applications', { cache: 'no-store' });
      const data = (await res.json().catch(() => ({}))) as {
        applications?: ApplicationRecord[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Erreur lors du chargement de votre carnet.');
        return;
      }
      setApplications(data.applications ?? []);
      setError(null);
    } catch {
      setError('Impossible de charger vos candidatures pour le moment.');
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // Chargement initial du carnet (fetch externe, setState après await).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const sorted = useMemo(
    () =>
      [...applications].sort(
        (a, b) =>
          new Date(b.applied_at || b.created_at).getTime() -
          new Date(a.applied_at || a.created_at).getTime(),
      ),
    [applications],
  );

  const visible = useMemo(
    () =>
      filter === 'all'
        ? sorted
        : sorted.filter((app) => filterGroup(app.status) === filter),
    [filter, sorted],
  );

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      all: sorted.length,
      to_finalize: 0,
      sent: 0,
      response_received: 0,
      closed: 0,
    };
    for (const app of sorted) result[filterGroup(app.status)] += 1;
    return result;
  }, [sorted]);

  async function updateStatus(app: ApplicationRecord, status: CandidateUpdatableStatus) {
    if (updatingId) return;
    setUpdatingId(app.id);
    setError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: app.id, status }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        application?: ApplicationRecord;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Impossible de mettre à jour cette candidature.');
        return;
      }
      if (data.application) {
        setApplications((prev) =>
          prev.map((item) => (item.id === data.application!.id ? data.application! : item)),
        );
      }
    } catch {
      setError('Erreur réseau : le statut n’a pas été mis à jour.');
    } finally {
      setUpdatingId(null);
    }
  }

  if (!loaded) {
    return (
      <div className="rounded-3xl border border-line bg-white p-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="h-5 w-40 animate-pulse rounded bg-surface dark:bg-slate-800" />
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-surface dark:bg-slate-900"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section
      id="candidatures"
      className="rounded-3xl border border-line bg-white p-5 dark:border-slate-800 dark:bg-slate-950 sm:p-8"
    >
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-[var(--font-display)] text-lg font-bold text-black dark:text-white">
            Mon carnet de candidatures
          </h2>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-black/60 dark:text-white/70">
            TravaillerEnCi n’envoie pas vos candidatures. Retrouvez ici celles que
            vous avez commencées, puis finalisez-les chez l’employeur.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-brand-soft px-3 py-1 text-[11px] font-bold text-primary dark:bg-brand/15 dark:text-brand-accent">
          {sorted.length} candidature{sorted.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error ? (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-rose-500/30 px-3 py-1.5 font-bold transition-colors hover:bg-rose-500/10"
          >
            Réessayer
          </button>
        </div>
      ) : null}

      {sorted.length > 0 ? (
        <div className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {FILTERS.map((item) => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              aria-pressed={filter === item.value}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition-all',
                filter === item.value
                  ? 'border-primary bg-primary text-white'
                  : 'border-line bg-white text-black hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-white',
              )}
            >
              {item.label} ({counts[item.value]})
            </button>
          ))}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center dark:border-slate-700">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-primary dark:bg-brand/15 dark:text-brand-accent">
            <svg
              className="h-7 w-7"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5l5 5v9a2 2 0 0 1-2 2h-1" />
              <path d="M9 18H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h10a2 2 0 0 0 2-2 2 2 0 0 0-2-2" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-black dark:text-white">
            Votre carnet est vide
          </p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-black/60 dark:text-white/70">
            Depuis une offre, cliquez sur « Postuler » : la candidature sera
            enregistrée ici avant votre redirection vers l’employeur.
          </p>
          <Link
            href="/jobs"
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-primary-dark"
          >
            Parcourir les offres
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-black/60 dark:border-slate-700 dark:text-white/70">
          Aucune candidature dans cette catégorie.
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((app) => {
            const external = normalizeHttpUrl(app.job_apply_link, 2000);
            const email = normalizeApplyEmail(app.job_apply_email);
            const jobPath = buildJobPath(app.job_id);
            const busy = updatingId === app.id;

            return (
              <li
                key={app.id}
                className="rounded-2xl border border-line bg-white p-3.5 transition-colors hover:border-primary/25 dark:border-slate-800 dark:bg-slate-950 sm:p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={jobPath}
                      className="block truncate text-sm font-bold text-black transition-colors hover:text-primary dark:text-white dark:hover:text-brand-accent"
                    >
                      {app.job_title || 'Offre sans titre'}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-black/60 dark:text-white/70">
                      {app.company || 'Entreprise inconnue'}
                    </p>
                    <p className="mt-1 text-[11px] text-black/50 dark:text-white/50">
                      Enregistrée le {formatDate(app.applied_at || app.created_at)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold',
                      statusTone(app.status),
                    )}
                  >
                    {statusLabel(app.status)}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {isFinalizable(app.status) && external ? (
                    <a
                      href={external}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() =>
                        trackEvent('application_external_redirect', {
                          label: app.job_id,
                          path: '/dashboard/candidate',
                        })
                      }
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-primary-dark"
                    >
                      Finaliser sur le site
                    </a>
                  ) : isFinalizable(app.status) && email ? (
                    <a
                      href={buildMailtoHref(email, app.job_title || 'Offre', app.company)}
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-3 py-2 text-[11px] font-bold text-white transition-colors hover:bg-primary-dark"
                    >
                      Finaliser par email
                    </a>
                  ) : (
                    <Link
                      href={jobPath}
                      className="inline-flex items-center justify-center rounded-xl border border-line px-3 py-2 text-[11px] font-bold text-black transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-white"
                    >
                      Voir l’offre
                    </Link>
                  )}

                  {isFinalizable(app.status) ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(app, 'sent')}
                      className="inline-flex items-center justify-center rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] font-bold text-primary transition-colors hover:bg-primary/10 disabled:opacity-50 dark:text-brand-accent"
                    >
                      {busy ? '…' : 'J’ai postulé'}
                    </button>
                  ) : null}

                  {app.status === 'sent' || app.status === 'submitted' || app.status === 'reviewing' || app.status === 'shortlisted' || app.status === 'interview' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(app, 'response_received')}
                      className="inline-flex items-center justify-center rounded-xl border border-line px-3 py-2 text-[11px] font-bold text-black transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50 dark:border-slate-700 dark:text-white"
                    >
                      Réponse reçue
                    </button>
                  ) : null}

                  {app.status !== 'closed' ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void updateStatus(app, 'closed')}
                      className="inline-flex items-center justify-center rounded-xl px-2.5 py-2 text-[11px] font-semibold text-black/50 transition-colors hover:text-rose-600 disabled:opacity-50 dark:text-white/50 dark:hover:text-rose-300"
                    >
                      Clôturer
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

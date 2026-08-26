'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { JobOfferSchema, JobOfferSchemaStatus } from '@/types';

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return deadline;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(d);
}

function isDeadlinePassed(deadline: string | null) {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(iso));
}

export default function RecruiterOffersClient({
  initialJobs,
}: {
  initialJobs: JobOfferSchema[];
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobOfferSchema[]>(initialJobs);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'published' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const publishedCount = jobs.filter((j) => j.status === 'published').length;
  const rejectedCount = jobs.filter((j) => j.status === 'rejected').length;

  const filteredJobs = jobs.filter((job) => {
    const matchesStatus =
      statusFilter === 'all' ? true : job.status === statusFilter;
    const matchesSearch =
      search === '' ||
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company.toLowerCase().includes(search.toLowerCase()) ||
      job.location.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  async function handleUpdateStatus(job: JobOfferSchema, newStatus: JobOfferSchemaStatus) {
    const isVerified = newStatus === 'published' ? true : job.is_verified;
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, status: newStatus, is_verified: isVerified } : j))
    );

    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, is_verified: isVerified }),
      });
      if (res.status === 401) {
        router.replace('/admin/login?next=/admin/recruiters');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erreur serveur');
      }
      startTransition(() => { router.refresh(); });
    } catch {
      // Rollback optimistic update
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: job.status, is_verified: job.is_verified } : j))
      );
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette offre ? Cette action est irréversible.')) return;
    const previous = [...jobs];
    setJobs((prev) => prev.filter((j) => j.id !== id));
    try {
      const res = await fetch(`/api/admin/jobs/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        setJobs(previous);
        router.replace('/admin/login?next=/admin/recruiters');
        return;
      }
      if (!res.ok) throw new Error('Erreur suppression');
      startTransition(() => { router.refresh(); });
    } catch {
      setJobs(previous);
    }
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
          Offres des recruteurs
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Modérez les offres publiées via l&apos;espace recruteur self-service (/publier-offre).
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'En attente', count: pendingCount, color: 'bg-amber-500', textColor: 'text-amber-400' },
          { label: 'Publiées', count: publishedCount, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
          { label: 'Rejetées', count: rejectedCount, color: 'bg-rose-500', textColor: 'text-rose-400' },
          { label: 'Total', count: jobs.length, color: 'bg-slate-500', textColor: 'text-slate-300' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`h-2 w-2 rounded-full ${stat.color}`} />
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className={`text-2xl font-black font-[var(--font-display)] ${stat.textColor}`}>
              {stat.count}
            </div>
          </div>
        ))}
      </div>

      {/* Status tabs + search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'pending' as const, label: 'En attente', count: pendingCount, activeColor: 'bg-amber-500 text-slate-950' },
            { value: 'published' as const, label: 'Publiées', count: publishedCount, activeColor: 'bg-emerald-500 text-slate-950' },
            { value: 'rejected' as const, label: 'Rejetées', count: rejectedCount, activeColor: 'bg-rose-500 text-white' },
            { value: 'all' as const, label: 'Toutes', count: jobs.length, activeColor: 'bg-primary text-slate-950' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                statusFilter === tab.value
                  ? tab.activeColor
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {tab.label}
              <span className="bg-black/20 px-1.5 py-0.5 rounded-full text-[10px]">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 sm:flex-none sm:w-64">
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Offers list */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-12 text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-slate-400 text-sm font-medium">
              {statusFilter === 'pending'
                ? 'Aucune offre en attente de modération.'
                : 'Aucune offre dans cette catégorie.'}
            </p>
          </div>
        ) : (
          filteredJobs.map((job) => (
            <div
              key={job.id}
              className={`rounded-2xl border transition-all ${
                job.status === 'pending'
                  ? 'border-amber-500/20 bg-amber-500/5'
                  : job.status === 'published'
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : job.status === 'rejected'
                  ? 'border-rose-500/20 bg-rose-500/5'
                  : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              {/* Card header */}
              <div className="p-5">
                <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                        job.status === 'published'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : job.status === 'rejected'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          job.status === 'published' ? 'bg-emerald-400' : job.status === 'rejected' ? 'bg-rose-400' : 'bg-amber-400'
                        }`} />
                        {job.status === 'published' ? 'Publiée' : job.status === 'rejected' ? 'Rejetée' : 'En attente'}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {relativeTime(job.created_at)}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white truncate">{job.title}</h3>
                    <div className="text-sm text-slate-400 mt-0.5">
                      {job.company} · {job.location}
                    </div>
                  </div>

                  {/* Quick actions for pending */}
                  {job.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleUpdateStatus(job, 'published')}
                        className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20 transition-colors inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 6 9 17l-5-5" />
                        </svg>
                        Approuver
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(job, 'rejected')}
                        className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold border border-rose-500/20 transition-colors inline-flex items-center gap-1.5"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M18 6 6 18M6 6l12 12" />
                        </svg>
                        Rejeter
                      </button>
                    </div>
                  )}
                </div>

                {/* Details grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  <div className="rounded-xl bg-slate-800/50 px-3 py-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Contrat</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5">{job.contract_type}</div>
                  </div>
                  <div className="rounded-xl bg-slate-800/50 px-3 py-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Email</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                      {job.apply_email || '—'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-800/50 px-3 py-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Lien</div>
                    <div className="text-xs font-bold text-slate-200 mt-0.5 truncate">
                      {job.apply_link ? (
                        <a href={job.apply_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Voir le lien →
                        </a>
                      ) : '—'}
                    </div>
                  </div>
                  <div className="rounded-xl bg-slate-800/50 px-3 py-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Deadline</div>
                    <div className={`text-xs font-bold mt-0.5 ${job.deadline && isDeadlinePassed(job.deadline) ? 'text-rose-400' : 'text-slate-200'}`}>
                      {job.deadline ? formatDeadline(job.deadline) : '—'}
                      {job.deadline && isDeadlinePassed(job.deadline) && ' ⏰'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable description */}
              <div className="border-t border-slate-800/50">
                <button
                  onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/30 transition-colors"
                >
                  <span>{expandedId === job.id ? 'Masquer la description' : 'Voir la description'}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedId === job.id ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                  </svg>
                </button>
                {expandedId === job.id && (
                  <div className="px-5 pb-4 space-y-4">
                    <div className="rounded-xl bg-slate-800/30 p-4 border border-slate-800/50">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Description</div>
                      <div className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                        {job.description}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {job.status !== 'published' && (
                          <button
                            onClick={() => handleUpdateStatus(job, 'published')}
                            className="px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20"
                          >
                            Valider & Publier
                          </button>
                        )}
                        {job.status !== 'rejected' && (
                          <button
                            onClick={() => handleUpdateStatus(job, 'rejected')}
                            className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold border border-rose-500/20"
                          >
                            Rejeter
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(job.id)}
                          className="px-4 py-2 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold border border-rose-500/10"
                        >
                          Supprimer
                        </button>
                      </div>
                      <a
                        href={`/jobs/${job.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        Voir sur le site →
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

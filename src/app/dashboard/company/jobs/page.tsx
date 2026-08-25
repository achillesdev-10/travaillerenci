'use client';

/**
 *  TravaillerEnCi — /dashboard/company/jobs
 *
 *  Liste des offres publiées par l'entreprise connectée.
 *  Permet de visualiser, éditer et clôturer ses offres.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '@/lib/clientAuth';
import { formatDate } from '@/lib/utils';
import type { JobOfferSchema } from '@/types';

type OfferStatus = 'pending' | 'published' | 'archived' | 'rejected';

const STATUS_BADGES: Record<OfferStatus, { label: string; classes: string }> = {
  pending: {
    label: 'En attente',
    classes: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  published: {
    label: 'Publiée',
    classes: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  archived: {
    label: 'Clôturée',
    classes: 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-gray-400 border-gray-200 dark:border-slate-700',
  },
  rejected: {
    label: 'Rejetée',
    classes: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
};

export default function CompanyJobsPage() {
  const router = useRouter();
  const [offers, setOffers] = useState<JobOfferSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    title: string;
    description: string;
    location: string;
    contract_type: string;
    apply_link: string;
    apply_email: string;
    deadline: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadOffers = useCallback(async () => {
    try {
      const res = await fetch('/api/company/jobs', { credentials: 'same-origin' });
      if (res.status === 401) {
        router.replace('/login?next=/dashboard/company/jobs');
        return;
      }
      const data = (await res.json()) as { offers: JobOfferSchema[] };
      setOffers(data.offers || []);
    } catch {
      // Erreur réseau silencieuse
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((current) => {
      if (cancelled) return;
      if (!current) {
        router.replace('/login?next=/dashboard/company/jobs');
        return;
      }
      void current; // vérifie que la session est active
      loadOffers().finally(() => {
        if (!cancelled) setLoading(false);
      });
    });
    return () => { cancelled = true; };
  }, [router, loadOffers]);

  async function handleClose(id: string) {
    if (!confirm('Voulez-vous vraiment clôturer cette offre ? Elle ne sera plus visible sur le site.')) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/company/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id, status: 'closed' }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Offre clôturée.' });
        await loadOffers();
      } else {
        const data = (await res.json()) as { error?: string };
        setMessage({ type: 'error', text: data.error || 'Erreur lors de la clôture.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau.' });
    } finally {
      setActionLoading(false);
    }
  }

  function startEdit(offer: JobOfferSchema) {
    setEditingId(offer.id);
    setEditForm({
      title: offer.title,
      description: offer.description,
      location: offer.location,
      contract_type: offer.contract_type,
      apply_link: offer.apply_link || '',
      apply_email: offer.apply_email || '',
      deadline: offer.deadline || '',
    });
  }

  async function handleEditSave() {
    if (!editingId || !editForm) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/company/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ id: editingId, ...editForm }),
      });
      if (res.ok) {
        setMessage({ type: 'success', text: 'Offre mise à jour.' });
        setEditingId(null);
        setEditForm(null);
        await loadOffers();
      } else {
        const data = (await res.json()) as { error?: string };
        setMessage({ type: 'error', text: data.error || 'Erreur lors de la mise à jour.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Erreur réseau.' });
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-gray-100 dark:bg-slate-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6 text-gray-900 dark:text-slate-50">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            href="/dashboard/company"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-primary mb-2"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Mon tableau de bord
          </Link>
          <h1 className="text-2xl lg:text-3xl font-extrabold font-[var(--font-display)]">
            Mes offres d&apos;emploi
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {offers.length} offre{offers.length !== 1 ? 's' : ''} au total
          </p>
        </div>
        <Link
          href="/dashboard/company/jobs/new"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-primary text-white text-sm font-bold hover:brightness-110 shadow-lg shadow-primary/20 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Nouvelle offre
        </Link>
      </div>

      {/* Message feedback */}
      {message && (
        <div
          className={`rounded-2xl p-4 text-sm font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300'
          }`}
        >
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-3 text-xs opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {/* Liste des offres */}
      {offers.length === 0 ? (
        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-12 text-center shadow-xl">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
            </svg>
          </div>
          <h2 className="text-lg font-bold mb-2">Aucune offre pour l&apos;instant</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Créez votre première offre pour commencer à recruter.
          </p>
          <Link
            href="/dashboard/company/jobs/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-primary text-white text-sm font-bold hover:brightness-110 shadow-lg shadow-primary/20 transition-all"
          >
            + Publier une offre
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {offers.map((offer) => {
            const badge = STATUS_BADGES[offer.status as OfferStatus] || STATUS_BADGES.pending;
            const isEditing = editingId === offer.id;

            return (
              <div
                key={offer.id}
                className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-xl overflow-hidden"
              >
                {isEditing && editForm ? (
                  /* ---- Mode édition ---- */
                  <div className="p-6 space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-bold text-sm text-primary">Édition de l&apos;offre</h3>
                      <button
                        onClick={() => { setEditingId(null); setEditForm(null); }}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        Annuler
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Titre</label>
                      <input
                        type="text"
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Description</label>
                      <textarea
                        rows={5}
                        value={editForm.description}
                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                        className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:border-primary resize-y"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Ville</label>
                        <input
                          type="text"
                          value={editForm.location}
                          onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Date limite</label>
                        <input
                          type="date"
                          value={editForm.deadline}
                          onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Lien candidature</label>
                        <input
                          type="url"
                          value={editForm.apply_link}
                          onChange={(e) => setEditForm({ ...editForm, apply_link: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1 ml-1">Email candidature</label>
                        <input
                          type="email"
                          value={editForm.apply_email}
                          onChange={(e) => setEditForm({ ...editForm, apply_email: e.target.value })}
                          className="w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={() => { setEditingId(null); setEditForm(null); }}
                        className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={handleEditSave}
                        disabled={actionLoading}
                        className="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        {actionLoading ? 'Sauvegarde…' : 'Sauvegarder'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* ---- Mode lecture ---- */
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${badge.classes}`}>
                            {badge.label}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-accent/10 text-accent px-2.5 py-0.5 text-[11px] font-bold">
                            {offer.contract_type}
                          </span>
                          {offer.is_verified && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-bold">
                              ✓ Vérifiée
                            </span>
                          )}
                        </div>
                        <h3 className="font-bold text-base sm:text-lg text-gray-900 dark:text-white line-clamp-1">
                          {offer.title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                          <span>{offer.location}</span>
                          <span>Publiée le {formatDate(offer.created_at)}</span>
                          {offer.deadline && (
                            <span>Limite : {formatDate(offer.deadline)}</span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Link
                          href={`/jobs/${offer.id}`}
                          target="_blank"
                          className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                        >
                          Voir
                        </Link>
                        {offer.status !== 'archived' && (
                          <>
                            <button
                              onClick={() => startEdit(offer)}
                              className="px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-800 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
                            >
                              Éditer
                            </button>
                            <button
                              onClick={() => handleClose(offer.id)}
                              disabled={actionLoading}
                              className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-800 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all disabled:opacity-50"
                            >
                              Clôturer
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Description tronquée */}
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                      {offer.description.replace(/\*\*/g, '').replace(/\n/g, ' ').slice(0, 200)}…
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

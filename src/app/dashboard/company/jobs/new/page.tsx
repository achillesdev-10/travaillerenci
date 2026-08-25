'use client';

/**
 *  TravaillerEnCi — /dashboard/company/jobs/new
 *
 *  Formulaire de publication d'offre d'emploi pour les entreprises connectées.
 *  L'offre est créée avec status='pending' (modération admin avant publication).
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { REGIONS_CI } from '@/lib/constants';

const CONTRACT_TYPES = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'Stage', label: 'Stage' },
  { value: 'Alternance', label: 'Alternance' },
  { value: 'Freelance', label: 'Freelance' },
  { value: 'Prestation', label: 'Prestation' },
] as const;

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contractType, setContractType] = useState('');
  const [applyLink, setApplyLink] = useState('');
  const [applyEmail, setApplyEmail] = useState('');
  const [deadline, setDeadline] = useState('');

  function validate(): string | null {
    if (!title.trim()) return 'Le titre du poste est obligatoire.';
    if (!description.trim()) return 'La description du poste est obligatoire.';
    if (!location) return 'La ville est obligatoire.';
    if (!contractType) return 'Le type de contrat est obligatoire.';
    if (!applyLink.trim() && !applyEmail.trim()) {
      return 'Renseignez au moins un lien de candidature ou une adresse email.';
    }
    if (applyLink.trim() && !/^https?:\/\//.test(applyLink.trim())) {
      return 'Le lien de candidature doit commencer par http:// ou https://.';
    }
    if (applyEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(applyEmail.trim())) {
      return 'L\'adresse email de candidature n\'est pas valide.';
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/company/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          location,
          contract_type: contractType,
          apply_link: applyLink.trim() || null,
          apply_email: applyEmail.trim() || null,
          deadline: deadline || null,
        }),
      });

      const data = (await res.json()) as { offer?: { id: string }; error?: string };

      if (!res.ok) {
        setError(data.error || 'Erreur lors de la création.');
        return;
      }

      setSuccess(true);
      // Rediriger vers la liste après 1.5s
      setTimeout(() => router.push('/dashboard/company/jobs'), 1500);
    } catch {
      setError('Erreur réseau. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <div className="rounded-3xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-900/20 p-8 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Offre créée avec succès !</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Votre offre est en attente de modération par notre équipe. Elle sera publiée après validation.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-3">Redirection automatique…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 text-gray-900 dark:text-slate-50">
      {/* Header */}
      <div>
        <Link
          href="/dashboard/company/jobs"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-primary mb-3"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Retour à mes offres
        </Link>
        <h1 className="text-2xl lg:text-3xl font-extrabold font-[var(--font-display)]">
          Publier une offre d&apos;emploi
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Remplissez les informations ci-dessous. Votre offre sera examinée par notre équipe avant publication.
        </p>
      </div>

      {/* Erreur globale */}
      {error && (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-sm text-rose-600 dark:text-rose-300">
          {error}
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 lg:p-8 shadow-xl space-y-5">
          <h2 className="font-bold text-lg">Informations du poste</h2>

          {/* Titre */}
          <div>
            <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Titre du poste *
            </label>
            <input
              type="text"
              required
              placeholder="Ex : Développeur Full Stack Senior"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Description du poste *
            </label>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 ml-1 mb-2">
              Vous pouvez utiliser le Markdown pour la mise en forme (**gras*, *italique*, listes, etc.)
            </p>
            <textarea
              required
              rows={8}
              placeholder="Décrivez les missions, responsabilités, profil recherché, conditions…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-sm focus:outline-none focus:border-primary resize-y"
            />
          </div>

          {/* Ville + Type de contrat */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Ville *
              </label>
              <select
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Sélectionner une ville</option>
                {REGIONS_CI.map((r) => (
                  <option key={r.slug} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Type de contrat *
              </label>
              <select
                required
                value={contractType}
                onChange={(e) => setContractType(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Sélectionner un type</option>
                {CONTRACT_TYPES.map((ct) => (
                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Date limite */}
          <div>
            <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Date limite de candidature (optionnel)
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full sm:w-auto rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Moyen de postuler */}
        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 lg:p-8 shadow-xl space-y-5">
          <h2 className="font-bold text-lg">Comment postuler ?</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Renseignez au moins un moyen de candidature.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Lien de candidature (optionnel)
              </label>
              <input
                type="url"
                placeholder="https:// votre-site.ci/candidature"
                value={applyLink}
                onChange={(e) => setApplyLink(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-sm focus:outline-none focus:border-primary"
              />
            </div>

            <div className="text-center text-xs text-gray-400 dark:text-gray-500 font-semibold">OU</div>

            <div>
              <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                Email de candidature (optionnel)
              </label>
              <input
                type="email"
                placeholder="recrutement@votre-entreprise.ci"
                value={applyEmail}
                onChange={(e) => setApplyEmail(e.target.value)}
                className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 px-4 py-3 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        </div>

        {/* Soumission */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3">
          <Link
            href="/dashboard/company/jobs"
            className="w-full sm:w-auto text-center px-6 py-3 rounded-2xl border border-gray-200 dark:border-slate-800 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
          >
            Annuler
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-8 py-3 rounded-2xl bg-primary text-white text-sm font-bold hover:brightness-110 shadow-lg shadow-primary/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Publication…' : 'Publier l\'offre'}
          </button>
        </div>
      </form>
    </div>
  );
}

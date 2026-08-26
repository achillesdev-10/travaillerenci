'use client';

import { useState } from 'react';
import Link from 'next/link';

const CONTRACT_TYPES = ['CDI', 'CDD', 'Stage', 'Prestation', 'Alternance', 'Freelance'];

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all';
const labelClass = 'block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5';

interface PublishForm {
  title: string;
  company: string;
  location: string;
  contract_type: string;
  description: string;
  apply_link: string;
  apply_email: string;
  contact_name: string;
  contact_phone: string;
  deadline: string;
}

const initialForm: PublishForm = {
  title: '',
  company: '',
  location: '',
  contract_type: 'CDI',
  description: '',
  apply_link: '',
  apply_email: '',
  contact_name: '',
  contact_phone: '',
  deadline: '',
};

export default function PublierOffrePage() {
  const [form, setForm] = useState<PublishForm>(initialForm);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const updateField = (field: keyof PublishForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch('/api/recruiter/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSuccess(true);
        setForm(initialForm);
      } else {
        setError(data.error || 'Erreur lors de la publication.');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-100 dark:border-slate-800 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold mb-4 border border-blue-200/60 dark:border-blue-800/40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              Espace Recruteur — Self-Service
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white font-[var(--font-display)]">
              Publiez votre offre{' '}
              <span className="text-primary">gratuitement</span>
            </h1>
            <p className="mt-3 text-gray-600 dark:text-gray-300 text-base md:text-lg leading-relaxed">
              Créez votre offre en quelques minutes. Elle sera mise en ligne après validation par notre équipe — <strong>100% gratuit</strong> pour les PME et startups ivoiriennes.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
        {/* Success message */}
        {success ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-8 shadow-sm text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-5">
              <svg className="h-8 w-8 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Offre soumise avec succès !
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 max-w-md mx-auto">
              Votre offre est en attente de validation par notre équipe. Vous recevrez une notification une fois qu&apos;elle sera publiée.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setSuccess(false)}
                className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md hover:brightness-110 transition-all"
              >
                Publier une autre offre
              </button>
              <Link
                href="/"
                className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-all"
              >
                Retour à l&apos;accueil
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-6">
              <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg shadow-md shadow-blue-500/20">
                📋
              </span>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  Informations sur l&apos;offre
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Les champs marqués * sont obligatoires
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-2.5">
                <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v4M12 16h.01" />
                </svg>
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}

            <div className="space-y-5">
              {/* Title & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Titre du poste *</label>
                  <input
                    type="text"
                    placeholder="Ex: Développeur Full-Stack React"
                    className={inputClass}
                    value={form.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Entreprise *</label>
                  <input
                    type="text"
                    placeholder="Ex: Orange Côte d'Ivoire"
                    className={inputClass}
                    value={form.company}
                    onChange={(e) => updateField('company', e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Location & Contract */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Localisation *</label>
                  <input
                    type="text"
                    placeholder="Ex: Abidjan, Plateau"
                    className={inputClass}
                    value={form.location}
                    onChange={(e) => updateField('location', e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Type de contrat *</label>
                  <select
                    className={inputClass}
                    value={form.contract_type}
                    onChange={(e) => updateField('contract_type', e.target.value)}
                  >
                    {CONTRACT_TYPES.map((ct) => (
                      <option key={ct} value={ct}>{ct}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Description du poste *</label>
                <textarea
                  rows={6}
                  placeholder="Décrivez le poste, les missions, les compétences requises, les avantages..."
                  className={inputClass + ' resize-none'}
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  required
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Minimum 20 caractères. Plus la description est détaillée, plus elle attirera de candidats qualifiés.
                </p>
              </div>

              {/* Apply */}
              <div className="border-t border-gray-100 dark:border-slate-800 pt-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-xs">✉️</span>
                  Comment postuler ?
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Lien de candidature</label>
                    <input
                      type="url"
                      placeholder="https://..."
                      className={inputClass}
                      value={form.apply_link}
                      onChange={(e) => updateField('apply_link', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Email de candidature</label>
                    <input
                      type="email"
                      placeholder="recrutement@entreprise.ci"
                      className={inputClass}
                      value={form.apply_email}
                      onChange={(e) => updateField('apply_email', e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Au moins un moyen de postuler est requis (lien ou email).
                </p>
              </div>

              {/* Contact */}
              <div className="border-t border-gray-100 dark:border-slate-800 pt-5">
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">👤</span>
                  Contact (optionnel)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Nom du contact</label>
                    <input
                      type="text"
                      placeholder="Ex: M. Kouassi"
                      className={inputClass}
                      value={form.contact_name}
                      onChange={(e) => updateField('contact_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone</label>
                    <input
                      type="tel"
                      placeholder="+225 07 00 00 00 00"
                      className={inputClass}
                      value={form.contact_phone}
                      onChange={(e) => updateField('contact_phone', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className={labelClass}>Date limite de candidature</label>
                <input
                  type="date"
                  className={inputClass}
                  value={form.deadline}
                  onChange={(e) => updateField('deadline', e.target.value)}
                />
              </div>
            </div>

            {/* Submit */}
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                📢 Votre offre sera examinée par notre équipe avant publication.
              </p>
              <button
                type="submit"
                disabled={loading || !form.title.trim() || !form.company.trim() || !form.description.trim() || !form.location.trim()}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Envoi en cours...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Publier l&apos;offre
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Info */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: '🆓',
              title: '100% Gratuit',
              desc: 'Publication offerte pour les PME et startups.',
            },
            {
              icon: '✅',
              title: 'Validation rapide',
              desc: 'Votre offre est examinée sous 24h.',
            },
            {
              icon: '🎯',
              title: 'Ciblage local',
              desc: 'Atteignez les candidats ivoiriens qualifiés.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center shadow-sm">
              <span className="text-2xl mb-2 block">{item.icon}</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

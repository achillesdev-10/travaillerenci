'use client';

import { useEffect, useState } from 'react';
import { REGIONS_CI, SECTORS } from '@/lib/constants';
import { DIPLOMA_FILTERS } from '@/lib/examConstants';
import { cn } from '@/lib/utils';

interface Profile {
  city: string | null;
  diploma: string | null;
  sectors: string[];
  phone: string | null;
}

const INITIAL: Profile = { city: null, diploma: null, sectors: [], phone: null };

/**
 * Section « Mon profil » du dashboard candidat : ville, diplôme, secteurs
 * d'intérêt et téléphone WhatsApp — les critères utilisés par les alertes.
 */
export default function ProfileSection() {
  const [profile, setProfile] = useState<Profile>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/candidate/profile', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        if (data?.profile) {
          setProfile({
            city: data.profile.city || null,
            diploma: data.profile.diploma || null,
            sectors: Array.isArray(data.profile.sectors) ? data.profile.sectors : [],
            phone: data.profile.phone || null,
          });
        }
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleSector(slug: string) {
    setProfile((prev) => ({
      ...prev,
      sectors: prev.sectors.includes(slug)
        ? prev.sectors.filter((s) => s !== slug)
        : [...prev.sectors, slug],
    }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/candidate/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: profile.city || null,
          diploma: profile.diploma || null,
          sectors: profile.sectors,
          phone: profile.phone || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Erreur lors de la sauvegarde.');
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError('Serveur injoignable. Réessayez.');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-8 text-center text-sm text-gray-400">
        Chargement du profil…
      </div>
    );
  }

  return (
    <form
      onSubmit={save}
      className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8 space-y-5"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold font-[var(--font-display)] text-gray-900 dark:text-white">
            Mon profil d'alerte
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Ces critères alimentent vos alertes (emplois, stages, bourses, concours).
            Complétez-les pour des notifications plus pertinentes.
          </p>
        </div>
        {saved ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-3 py-1.5 text-xs font-bold shrink-0">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            </svg>
            Enregistré
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Ville
          </label>
          <select
            value={profile.city || ''}
            onChange={(e) => setProfile({ ...profile, city: e.target.value || null })}
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
          >
            <option value="">Toutes les villes</option>
            {REGIONS_CI.map((r) => (
              <option key={r.slug} value={r.name}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Diplôme le plus élevé
          </label>
          <select
            value={profile.diploma || ''}
            onChange={(e) => setProfile({ ...profile, diploma: e.target.value || null })}
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
          >
            <option value="">Sélectionner un diplôme</option>
            {DIPLOMA_FILTERS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
          Secteurs d'intérêt
        </label>
        <div className="flex flex-wrap gap-1.5">
          {SECTORS.map((s) => (
            <button
              type="button"
              key={s.slug}
              onClick={() => toggleSector(s.slug)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                profile.sectors.includes(s.slug)
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
          Téléphone WhatsApp (pour les alertes WhatsApp)
        </label>
        <input
          type="tel"
          placeholder="2250700000000 (format international)"
          value={profile.phone || ''}
          onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
          className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
        />
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5 ml-1">
          Exemple : 2250700000000. Nécessaire uniquement si vous activez le canal WhatsApp.
        </p>
      </div>

      <div className="flex items-center justify-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-xl bg-primary hover:brightness-110 disabled:opacity-50 text-white px-6 py-3 text-xs font-bold shadow-lg shadow-primary/20 transition-all"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer mon profil'}
        </button>
      </div>
    </form>
  );
}

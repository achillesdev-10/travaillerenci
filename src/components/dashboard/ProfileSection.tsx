'use client';

import { useEffect, useMemo, useState } from 'react';
import { JOB_LEVELS, JOB_TYPES, REGIONS_CI, SECTORS } from '@/lib/constants';
import { DIPLOMA_FILTERS } from '@/lib/examConstants';
import { cn } from '@/lib/utils';
import { fetchCurrentUser } from '@/lib/clientAuth';
import { computeProfileCompletion } from '@/lib/profileCompletion';

interface Profile {
  city: string | null;
  diploma: string | null;
  sectors: string[];
  phone: string | null;
  job_title: string | null;
  experience_level: string | null;
  skills: string[];
  contract_types: string[];
  bio: string | null;
  resume_url: string | null;
}

const INITIAL: Profile = {
  city: null,
  diploma: null,
  sectors: [],
  phone: null,
  job_title: null,
  experience_level: null,
  skills: [],
  contract_types: [],
  bio: null,
  resume_url: null,
};

/**
 * Section « Mon profil » du dashboard candidat : identité professionnelle,
 * critères d'alertes et indicateur de complétion (master prompt §9).
 */
export default function ProfileSection() {
  const [profile, setProfile] = useState<Profile>(INITIAL);
  const [email, setEmail] = useState<string | null>(null);
  const [skillDraft, setSkillDraft] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((u) => {
        if (!cancelled) setEmail(u?.email ?? null);
      })
      .catch(() => {});

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
            job_title: data.profile.job_title || null,
            experience_level: data.profile.experience_level || null,
            skills: Array.isArray(data.profile.skills) ? data.profile.skills : [],
            contract_types: Array.isArray(data.profile.contract_types) ? data.profile.contract_types : [],
            bio: data.profile.bio || null,
            resume_url: data.profile.resume_url || null,
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

  const completion = useMemo(
    () =>
      computeProfileCompletion({
        email,
        city: profile.city,
        jobTitle: profile.job_title,
        sectors: profile.sectors,
        diploma: profile.diploma,
        experienceLevel: profile.experience_level,
        skills: profile.skills,
        contractTypes: profile.contract_types,
        phone: profile.phone,
        bio: profile.bio,
        resumeUrl: profile.resume_url,
      }),
    [email, profile],
  );

  function toggleSector(slug: string) {
    setProfile((prev) => ({
      ...prev,
      sectors: prev.sectors.includes(slug)
        ? prev.sectors.filter((s) => s !== slug)
        : [...prev.sectors, slug],
    }));
  }

  function toggleContract(value: string) {
    setProfile((prev) => ({
      ...prev,
      contract_types: prev.contract_types.includes(value)
        ? prev.contract_types.filter((c) => c !== value)
        : [...prev.contract_types, value],
    }));
  }

  function addSkill() {
    const skill = skillDraft.trim().slice(0, 40);
    if (!skill) return;
    setProfile((prev) => {
      if (prev.skills.some((s) => s.toLowerCase() === skill.toLowerCase())) return prev;
      return { ...prev, skills: [...prev.skills, skill].slice(0, 30) };
    });
    setSkillDraft('');
  }

  function removeSkill(skill: string) {
    setProfile((prev) => ({ ...prev, skills: prev.skills.filter((s) => s !== skill) }));
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
          job_title: profile.job_title || null,
          experience_level: profile.experience_level || null,
          skills: profile.skills,
          contract_types: profile.contract_types,
          bio: profile.bio || null,
          resume_url: profile.resume_url || null,
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

  const inputClass =
    'w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary';
  const labelClass =
    'block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1';

  return (
    <form
      onSubmit={save}
      className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8 space-y-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold font-[var(--font-display)] text-gray-900 dark:text-white">
            Mon profil candidat
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 max-w-md">
            Plus votre profil est complet, plus vos alertes et recommandations sont pertinentes.
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

      {/* Indicateur de complétion */}
      <div className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900/60 p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
            Profil complété à {completion.percent}%
          </span>
          <span className="text-[11px] text-gray-400">
            {completion.done}/{completion.total}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={completion.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Complétion du profil"
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-slate-800"
        >
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${completion.percent}%` }}
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {completion.items.map((item) => (
            <span
              key={item.key}
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                item.done
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'bg-gray-200/70 text-gray-500 dark:bg-slate-800 dark:text-slate-400',
              )}
            >
              <span aria-hidden="true">{item.done ? '✓' : '○'}</span>
              {item.label}
            </span>
          ))}
        </div>
        {completion.missingLabels.length > 0 ? (
          <p className="mt-2 text-[11px] text-gray-500 dark:text-slate-400">
            Complétez votre profil pour améliorer vos recommandations.
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="profile-job-title">
            Métier recherché
          </label>
          <input
            id="profile-job-title"
            type="text"
            placeholder="Ex : Développeur web, Comptable…"
            value={profile.job_title || ''}
            onChange={(e) => setProfile({ ...profile, job_title: e.target.value })}
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-city">
            Ville
          </label>
          <select
            id="profile-city"
            value={profile.city || ''}
            onChange={(e) => setProfile({ ...profile, city: e.target.value || null })}
            className={inputClass}
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
          <label className={labelClass} htmlFor="profile-experience">
            Niveau d&apos;expérience
          </label>
          <select
            id="profile-experience"
            value={profile.experience_level || ''}
            onChange={(e) => setProfile({ ...profile, experience_level: e.target.value || null })}
            className={inputClass}
          >
            <option value="">Sélectionner</option>
            {JOB_LEVELS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-diploma">
            Diplôme le plus élevé
          </label>
          <select
            id="profile-diploma"
            value={profile.diploma || ''}
            onChange={(e) => setProfile({ ...profile, diploma: e.target.value || null })}
            className={inputClass}
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
        <span className={labelClass}>Domaines d&apos;intérêt</span>
        <div className="flex flex-wrap gap-1.5">
          {SECTORS.map((s) => (
            <button
              type="button"
              key={s.slug}
              onClick={() => toggleSector(s.slug)}
              aria-pressed={profile.sectors.includes(s.slug)}
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
        <span className={labelClass}>Type de contrat recherché</span>
        <div className="flex flex-wrap gap-1.5">
          {JOB_TYPES.map((t) => (
            <button
              type="button"
              key={t.value}
              onClick={() => toggleContract(t.value)}
              aria-pressed={profile.contract_types.includes(t.value)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                profile.contract_types.includes(t.value)
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-accent/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="profile-skills">
          Compétences
        </label>
        <div className="flex gap-2">
          <input
            id="profile-skills"
            type="text"
            placeholder="Ex : Excel, React, comptabilité…"
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                addSkill();
              }
            }}
            className={inputClass}
          />
          <button
            type="button"
            onClick={addSkill}
            className="shrink-0 rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 text-xs font-bold text-gray-700 dark:text-gray-200 hover:border-primary/40 hover:text-primary transition-all"
          >
            Ajouter
          </button>
        </div>
        {profile.skills.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2.5 py-1 text-[11px] font-semibold"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  aria-label={`Retirer ${skill}`}
                  className="text-primary/70 hover:text-primary"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5 ml-1">
          Appuyez sur Entrée ou virgule pour ajouter une compétence.
        </p>
      </div>

      <div>
        <label className={labelClass} htmlFor="profile-bio">
          Présentation professionnelle
        </label>
        <textarea
          id="profile-bio"
          rows={3}
          maxLength={600}
          placeholder="Quelques lignes sur votre parcours et ce que vous recherchez…"
          value={profile.bio || ''}
          onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className={labelClass} htmlFor="profile-phone">
            Téléphone WhatsApp
          </label>
          <input
            id="profile-phone"
            type="tel"
            placeholder="2250700000000"
            value={profile.phone || ''}
            onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
            className={inputClass}
          />
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5 ml-1">
            Format international. Nécessaire pour les alertes WhatsApp.
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="profile-resume">
            Lien vers votre CV (facultatif)
          </label>
          <input
            id="profile-resume"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={profile.resume_url || ''}
            onChange={(e) => setProfile({ ...profile, resume_url: e.target.value })}
            className={inputClass}
          />
          <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-1.5 ml-1">
            Non exposé publiquement. Prêt pour la future CVthèque.
          </p>
        </div>
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

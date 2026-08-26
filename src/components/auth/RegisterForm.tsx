'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/auth/PasswordInput';
import { apiRegister } from '@/lib/authApi';
import { isGoogleAuthVisible } from '@/lib/config';
import { REGIONS_CI, SECTORS } from '@/lib/constants';
import { DIPLOMA_FILTERS } from '@/lib/examConstants';
import { cn } from '@/lib/utils';

type Role = 'candidate' | 'company';

interface RegisterFormProps {
  /** Rôle sélectionné par défaut (utilisé par la page Candidats). */
  defaultRole?: Role;
}

export default function RegisterForm({ defaultRole = 'candidate' }: RegisterFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(defaultRole);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  // Mini-profil optionnel (critères d'alertes) — candidats uniquement.
  const [profileCity, setProfileCity] = useState('');
  const [profileDiploma, setProfileDiploma] = useState('');
  const [profileSectors, setProfileSectors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleSector(slug: string) {
    setProfileSectors((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  /** Validation simple : email bien formé + mot de passe d'au moins 6 caractères. */
  function validate(): string | null {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return 'Veuillez saisir une adresse email valide.';
    }
    if (password.length < 6) {
      return 'Le mot de passe doit contenir au moins 6 caractères.';
    }
    if (!confirmPassword) {
      return 'Veuillez confirmer votre mot de passe.';
    }
    if (confirmPassword !== password) {
      return 'Les deux mots de passe ne correspondent pas.';
    }
    return null;
  }

  /** Robustesse du mot de passe : 0-4 (longueur + variété). */
  function passwordStrength(value: string): number {
    if (!value) return 0;
    let score = 0;
    if (value.length >= 6) score += 1;
    if (value.length >= 10) score += 1;
    if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
    if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
    return Math.min(score, 4);
  }

  function redirectToDashboard() {
    router.push(role === 'candidate' ? '/dashboard/candidate' : '/dashboard/company');
  }

  function googleAuthHref(): string {
    const next =
      role === 'company' ? '/dashboard/company' : '/dashboard/candidate';
    return `/api/auth/google?role=${role}&next=${encodeURIComponent(next)}`;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await apiRegister({
        email,
        name: role === 'candidate' ? name : companyName,
        password,
        role,
        ...(role === 'candidate'
          ? {
              city: profileCity || undefined,
              diploma: profileDiploma || undefined,
              sectors: profileSectors.length > 0 ? profileSectors : undefined,
            }
          : {}),
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      // Succès : la session (cookie httpOnly) a été posée par le serveur.
      redirectToDashboard();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l’inscription');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-8 rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
      <div className="text-center space-y-2">
        <Link
          href="/"
          className="inline-block text-2xl font-black text-primary font-[var(--font-display)]"
        >
          Travailleren<span className="text-gray-900 dark:text-white">Ci</span>
        </Link>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Créer un compte</h2>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Rejoignez la première plateforme d’emploi en Côte d’Ivoire
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <label className="block text-xs font-bold text-gray-700 dark:text-slate-400 uppercase tracking-widest">
          Je souhaite :
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setRole('candidate')}
            className={`rounded-2xl border p-4 text-left transition-all ${
              role === 'candidate'
                ? 'border-primary bg-primary/10 text-primary dark:text-white shadow-lg shadow-primary/10'
                : 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-sm">Candidat</div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Je cherche un emploi ou un stage
            </div>
          </button>

          <button
            type="button"
            onClick={() => setRole('company')}
            className={`rounded-2xl border p-4 text-left transition-all ${
              role === 'company'
                ? 'border-primary bg-primary/10 text-primary dark:text-white shadow-lg shadow-primary/10'
                : 'border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 text-gray-700 dark:text-slate-400 hover:border-gray-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="font-bold text-sm">Entreprise</div>
            <div className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5">
              Je recrute des talents
            </div>
          </button>
        </div>
      </div>

      <form onSubmit={handleRegister} className="space-y-4 pt-2">
        {role === 'candidate' ? (
          <div>
            <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Nom complet
            </label>
            <input
              type="text"
              required
              placeholder="Koffi Kouadio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
            />
          </div>
        ) : (
          <div>
            <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
              Nom de l’entreprise
            </label>
            <input
              type="text"
              required
              placeholder="MTN Côte d’Ivoire"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
            />
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
            Email professionnel ou personnel
          </label>
          <input
            type="email"
            required
            placeholder="vous@exemple.ci"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <PasswordInput
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          {password && (
            <div className="mt-2 px-1">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((level) => (
                  <div
                    key={level}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      level <= passwordStrength(password)
                        ? passwordStrength(password) <= 2
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                        : 'bg-gray-200 dark:bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <p
                className={`mt-1 text-[10px] font-semibold ${
                  passwordStrength(password) <= 2
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {passwordStrength(password) <= 2
                  ? 'Mot de passe faible — ajoutez au moins 10 caractères et mélangez lettres, chiffres et symboles.'
                  : 'Mot de passe solide ✓'}
              </p>
            </div>
          )}
        </div>

        <PasswordInput
          label="Confirmer le mot de passe"
          value={confirmPassword}
          onChange={setConfirmPassword}
          autoComplete="new-password"
        />
        {confirmPassword && confirmPassword !== password ? (
          <p className="-mt-2 ml-1 text-[11px] font-semibold text-rose-500">
            Les mots de passe ne correspondent pas.
          </p>
        ) : null}

        {/* Mini-profil optionnel — alimente les alertes (voir 3.3) */}
        {role === 'candidate' && (
          <details className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-950/50 p-4 group">
            <summary className="cursor-pointer list-none text-xs font-bold text-gray-700 dark:text-slate-300 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5">
                <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
                Profil d'alerte (optionnel)
              </span>
              <svg className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-180" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </summary>
            <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-2 mb-3">
              Renseignez vos critères pour recevoir des alertes personnalisées
              (emplois, stages, bourses, concours). Complétable à tout moment
              depuis votre espace.
            </p>
            <div className="space-y-3.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                  Ville
                </label>
                <select
                  value={profileCity}
                  onChange={(e) => setProfileCity(e.target.value)}
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
                  value={profileDiploma}
                  onChange={(e) => setProfileDiploma(e.target.value)}
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
                        profileSectors.includes(s.slug)
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </details>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-2xl bg-primary py-3.5 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-primary/20 mt-4 disabled:opacity-50"
        >
          {loading ? 'Création du compte...' : 'S’inscrire'}
        </button>
      </form>

      {isGoogleAuthVisible() && (
        <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-gray-500 dark:text-slate-400">
                Ou continuer avec
              </span>
            </div>
          </div>

          <a
            href={googleAuthHref()}
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-950 py-3.5 px-4 text-xs font-bold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.1 8.9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.2-2 .4-2.7L1.6 6.4C.6 8.4 0 10.1 0 12s.6 3.6 1.6 5.6l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5.3L1.6 15.6C3.5 19.4 7.4 23 12 23z"
              />
            </svg>
            S’inscrire avec Google
          </a>
        </>
      )}

      <div className="text-center text-xs text-gray-500 dark:text-slate-400">
        Vous avez déjà un compte ?{' '}
        <Link href="/login" className="text-primary font-bold hover:underline">
          Se connecter
        </Link>
      </div>
    </div>
  );
}

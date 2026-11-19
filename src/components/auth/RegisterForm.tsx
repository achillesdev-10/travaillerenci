'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PasswordInput from '@/components/auth/PasswordInput';
import { apiRegister } from '@/lib/authApi';
import { fetchCurrentUser, logoutCurrentUser, type StoredUser } from '@/lib/clientAuth';
import { isGoogleAuthVisible } from '@/lib/config';
import { safeInternalPath } from '@/lib/applicationRules';
import { trackEvent } from '@/lib/analyticsClient';

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
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Session déjà active : le formulaire d'inscription n'a pas lieu d'être.
  // /register est déjà redirigé par le proxy ; ce garde-fou couvre le
  // formulaire embarqué de /candidates et une session posée après le rendu.
  const [sessionUser, setSessionUser] = useState<StoredUser | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [loginHref, setLoginHref] = useState('/login');
  const signupStartedRef = useRef(false);

  function markSignupStart() {
    if (signupStartedRef.current) return;
    signupStartedRef.current = true;
    trackEvent('signup_start', { label: role });
  }

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser().then((user) => {
      if (cancelled) return;
      setSessionUser(user);
      setSessionChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionChecked || sessionUser) return;
    trackEvent('register_view');
  }, [sessionChecked, sessionUser]);

  // Lien « Se connecter » : conserver la destination d'origine. Lecture URL
  // unique au montage, pas d'alternative React.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    if (typeof window === 'undefined') return;
    const raw = new URLSearchParams(window.location.search).get('next');
    const safe = safeInternalPath(raw, '');
    if (safe) setLoginHref(`/login?next=${encodeURIComponent(safe)}`);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  /** Déconnexion puis rechargement : le formulaire (et l'en-tête) réapparaissent. */
  async function switchAccount() {
    await logoutCurrentUser();
    window.location.reload();
  }

  /** Nom affiché dérivé de l'email : complété ensuite depuis le tableau de bord. */
  function candidateNameFromEmail(value: string): string {
    const local = value.split('@')[0] ?? '';
    const cleaned = local.replace(/[._-]+/g, ' ').trim();
    if (!cleaned) return 'Candidat';
    return cleaned
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
    if (role === 'company' && !companyName.trim()) {
      return "Veuillez renseigner le nom de l'entreprise.";
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

  /** Ramène vers l'offre d'origine (?next=) après inscription, sinon dashboard. */
  function nextDestination(forRole: Role = role): string {
    const fallback = forRole === 'company' ? '/dashboard/company' : '/dashboard/candidate';
    if (typeof window === 'undefined') return fallback;
    const raw = new URLSearchParams(window.location.search).get('next');
    return safeInternalPath(raw, fallback);
  }

  function redirectToDashboard() {
    router.push(nextDestination());
  }

  function googleAuthHref(): string {
    const next = nextDestination();
    return `/api/auth/google?role=${role}&next=${encodeURIComponent(next)}`;
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      trackEvent('signup_error', { label: 'validation' });
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await apiRegister({
        email,
        name: role === 'candidate' ? candidateNameFromEmail(email) : companyName.trim(),
        password,
        role,
      });

      if (!result.ok) {
        trackEvent('signup_error', { label: 'api' });
        setError(result.error);
        return;
      }

      // Succès : la session (cookie httpOnly) a été posée par le serveur.
      redirectToDashboard();
    } catch (err: unknown) {
      trackEvent('signup_error', { label: 'network' });
      setError(err instanceof Error ? err.message : 'Erreur lors de l’inscription');
    } finally {
      setLoading(false);
    }
  }

  // Déjà connecté → pas de formulaire d'inscription : on oriente vers l'espace
  // personnel (ou vers une autre session si l'utilisateur veut en changer).
  if (sessionChecked && sessionUser) {
    const home = nextDestination(
      sessionUser.role === 'company' ? 'company' : 'candidate',
    );
    return (
      <div
        className="w-full max-w-md space-y-5 rounded-3xl border border-line dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl text-center"
        data-testid="register-already-authenticated"
      >
        <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
          Session active
        </span>
        <h2 className="text-xl font-bold text-black dark:text-white">
          Vous êtes déjà connecté
        </h2>
        <p className="text-sm text-black dark:text-white">
          {sessionUser.email} est connecté
          {sessionUser.role === 'company' ? ' en tant qu’entreprise' : ''} : l’inscription est
          inutile. Accédez à votre espace, ou déconnectez-vous pour créer un autre compte.
        </p>
        <div className="space-y-3">
          <Link
            href={home}
            className="block w-full rounded-2xl bg-primary py-3.5 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-primary/20"
          >
            Accéder à mon espace
          </Link>
          <button
            type="button"
            onClick={switchAccount}
            className="block w-full rounded-2xl border border-line dark:border-slate-700 py-3 text-xs font-bold text-black dark:text-white hover:border-primary/40 hover:text-primary transition-all"
          >
            Se déconnecter pour un autre compte
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md space-y-8 rounded-3xl border border-line dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
      <div className="text-center space-y-2">
        <Link
          href="/"
          className="inline-block text-2xl font-black text-primary font-[var(--font-display)]"
        >
          Travailleren<span className="text-black dark:text-white">Ci</span>
        </Link>
        <h2 className="text-xl font-bold text-black dark:text-white">
          {role === 'candidate' ? 'Créer un compte candidat' : 'Créer un compte entreprise'}
        </h2>
        <p className="text-sm text-black/70 dark:text-slate-300">
          {role === 'candidate'
            ? 'Deux champs suffisent. C’est gratuit.'
            : 'Publiez vos offres et recevez des candidatures.'}
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-600 dark:text-rose-300"
        >
          {error}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950">
        <span className="text-sm font-semibold text-black dark:text-white">
          {role === 'candidate' ? 'Compte candidat' : 'Compte entreprise'}
        </span>
        <button
          type="button"
          onClick={() => {
            setRole(role === 'candidate' ? 'company' : 'candidate');
            setError(null);
          }}
          className="min-h-9 rounded-lg px-2 text-sm font-bold text-primary hover:underline dark:text-brand-accent"
        >
          {role === 'candidate' ? 'Vous recrutez ?' : 'Je cherche un emploi'}
        </button>
      </div>

      <form onSubmit={handleRegister} className="space-y-4">
        {role === 'company' ? (
          <div>
            <label htmlFor="register-company" className="mb-1.5 block text-sm font-semibold text-black dark:text-white">
              Nom de l’entreprise
            </label>
            <input
              id="register-company"
              type="text"
              required
              placeholder="MTN Côte d’Ivoire"
              value={companyName}
              onChange={(e) => {
                markSignupStart();
                setCompanyName(e.target.value);
              }}
              className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-black focus:border-primary focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
            />
          </div>
        ) : null}

        <div>
          <label htmlFor="register-email" className="mb-1.5 block text-sm font-semibold text-black dark:text-white">
            Email professionnel ou personnel
          </label>
          <input
            id="register-email"
            type="email"
            required
            placeholder="vous@exemple.ci"
            value={email}
            onChange={(e) => {
              markSignupStart();
              setEmail(e.target.value);
            }}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-base text-black focus:border-primary focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div>
          <PasswordInput
            label="Mot de passe"
            value={password}
            onChange={(value) => {
              markSignupStart();
              setPassword(value);
            }}
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
                          : 'bg-brand'
                        : 'bg-gray-200 dark:bg-slate-800'
                    }`}
                  />
                ))}
              </div>
              <p
                className={`mt-1 text-xs font-semibold ${
                  passwordStrength(password) <= 2
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-brand dark:text-brand-accent'
                }`}
              >
                {passwordStrength(password) <= 2
                  ? 'Mot de passe faible — ajoutez au moins 10 caractères et mélangez lettres, chiffres et symboles.'
                  : 'Mot de passe solide ✓'}
              </p>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark disabled:opacity-50"
        >
          {loading ? 'Création du compte...' : 'S’inscrire gratuitement'}
        </button>
        <p className="text-center text-xs text-black/60 dark:text-slate-400">
          Gratuit, sans carte bancaire.
        </p>
      </form>

      {isGoogleAuthVisible() && (
        <>
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-line dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-black dark:text-white">
                Ou continuer avec
              </span>
            </div>
          </div>

          <a
            href={googleAuthHref()}
            onClick={() => {
              markSignupStart();
              trackEvent('google_signup_click', { label: role });
            }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm font-bold text-black shadow-sm transition-all hover:bg-brand-soft dark:border-slate-800 dark:bg-slate-950 dark:text-white dark:hover:bg-slate-800"
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

      <div className="text-center text-xs text-black dark:text-white">
        Vous avez déjà un compte ?{' '}
        <Link href={loginHref} className="text-primary font-bold hover:underline">
          Se connecter
        </Link>
      </div>
    </div>
  );
}

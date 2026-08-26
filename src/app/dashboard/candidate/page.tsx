'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchCurrentUser, type StoredUser } from '@/lib/clientAuth';
import SetPasswordForm from '@/components/auth/SetPasswordForm';
import ProfileSection from '@/components/dashboard/ProfileSection';
import SavedItemsSection from '@/components/dashboard/SavedItemsSection';
import AlertsSection from '@/components/dashboard/AlertsSection';
import NotificationsSection from '@/components/dashboard/NotificationsSection';
import AvatarUpload from '@/components/dashboard/AvatarUpload';

/** Actions rapides — accès en un clic depuis le dashboard. */
const QUICK_ACTIONS = [
  {
    title: 'Rechercher un emploi',
    description: 'Parcourez les offres vérifiées et postulez en ligne.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    href: '/jobs',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  },
  {
    title: 'Créer mon CV',
    description: 'Générez un CV professionnel optimisé par l\'IA.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    href: '/generateur-de-cv',
    color: 'bg-primary/10 text-primary',
  },
  {
    title: 'Bourses & concours',
    description: 'Accédez aux opportunités éducatives officielles.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    href: '/bourses',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  },
  {
    title: 'Conseils carrière',
    description: 'Guides, préparation aux entretiens et astuces.',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    href: '/blog',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  },
];

export default function CandidateDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<StoredUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((current) => {
        if (cancelled) return;
        if (!current) {
          router.replace('/login?next=/dashboard/candidate');
          return;
        }
        setUser(current);
        setAvatarUrl(current.avatar_url ?? null);
        setHydrated(true);
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const firstName = user ? (user.name.split(' ')[0] || user.email.split('@')[0]) : '';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* ===== Bandeau supérieur — identité utilisateur + barre latérale d'action ===== */}
      <div className="border-b border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-5">
            <div className="flex items-center gap-4">
              {/* Avatar cliquable pour upload */}
              {hydrated && user ? (
                <AvatarUpload
                  avatarUrl={avatarUrl}
                  name={user.name}
                  onChange={setAvatarUrl}
                  size={48}
                />
              ) : (
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-emerald-400 flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary/20 shrink-0" />
              )}
              <div>
                <h1 className="text-lg font-bold font-[var(--font-display)] text-gray-900 dark:text-white">
                  {hydrated && user ? `Bonjour, ${firstName} !` : 'Chargement…'}
                </h1>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {user ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Espace candidat sécurisé
                    </span>
                  ) : (
                    'Chargement de votre espace…'
                  )}
                </p>
              </div>
            </div>
            {/* Actions rapides dans la barre */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href="/jobs"
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 shadow-lg shadow-primary/20 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Offres d'emploi
              </Link>
              <Link
                href="/generateur-de-cv"
                className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Mon CV
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Alerte : compte migré sans mot de passe → définir un mot de passe */}
        {user?.needs_password_reset ? (
          <div className="rounded-3xl border border-orange-500/40 bg-orange-50 dark:bg-slate-900 dark:border-orange-500/30 p-6 lg:p-8 shadow-xl flex flex-col lg:flex-row gap-8">
            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 border border-orange-500/30 mb-4">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Action requise
              </span>
              <h2 className="text-xl font-bold font-[var(--font-display)] mb-2">
                Sécurisez votre compte
              </h2>
              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                Votre compte a été migré depuis l'ancien système (ou créé via Google)
                et ne possède pas encore de mot de passe. Définissez-en un pour vous
                connecter par email et protéger vos données.
              </p>
            </div>
            <div className="w-full lg:w-80">
              <SetPasswordForm
                onSuccess={() => {
                  setUser((prev) => (prev ? { ...prev, needs_password_reset: false } : prev));
                }}
              />
            </div>
          </div>
        ) : null}

        {/* ===== Actions rapides ===== */}
        <section>
          <h2 className="text-sm font-bold font-[var(--font-display)] text-gray-900 dark:text-white mb-3 uppercase tracking-wider">
            Accès rapide
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.title}
                href={action.href}
                className="group rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 hover:-translate-y-0.5 hover:shadow-xl hover:border-primary/20 transition-all duration-200"
              >
                <div className={`w-10 h-10 rounded-xl ${action.color} flex items-center justify-center mb-3`}>
                  {action.icon}
                </div>
                <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-0.5">
                  {action.title}
                </h3>
                <p className="text-[11px] text-gray-500 dark:text-slate-400 leading-relaxed">
                  {action.description}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {/* ===== Deux colonnes : profil + alertes | offres sauvegardées ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Colonne principale (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profil d'alerte */}
            <section aria-label="Mon profil d'alerte">
              <ProfileSection />
            </section>

            {/* Offres sauvegardées */}
            <section aria-label="Mes offres sauvegardées">
              <SavedItemsSection />
            </section>

            {/* Notifications récentes */}
            <section aria-label="Notifications récentes">
              <NotificationsSection />
            </section>
          </div>

          {/* Colonne latérale (1/3) */}
          <div className="space-y-6">
            {/* Alertes personnalisées */}
            <section aria-label="Mes alertes">
              <AlertsSection />
            </section>

            {/* Statut du compte */}
            <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-sm font-bold font-[var(--font-display)] text-gray-900 dark:text-white mb-3">
                Mon compte
              </h3>
              <ul className="space-y-2.5 text-xs">
                <li className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Email</span>
                  <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
                    {user?.email || '—'}
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Rôle</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-[11px] font-bold">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    Candidat
                  </span>
                </li>
                <li className="flex items-center justify-between">
                  <span className="text-gray-500 dark:text-slate-400">Sécurité</span>
                  <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    Protégé
                  </span>
                </li>
              </ul>
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                <Link
                  href="/"
                  className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 hover:text-primary transition-colors"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  Retour à l'accueil
                </Link>
              </div>
            </div>

            {/* Prochaines étapes */}
            <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="text-sm font-bold font-[var(--font-display)] text-gray-900 dark:text-white mb-3">
                Prochaines étapes
              </h3>
              <ol className="space-y-3">
                {[
                  { label: 'Créez votre CV en ligne', href: '/generateur-de-cv' },
                  { label: 'Activez vos alertes emploi', href: '/jobs' },
                  { label: 'Postulez aux offres vérifiées', href: '/jobs' },
                  { label: 'Consultez bourses et concours', href: '/bourses' },
                ].map((step, i) => (
                  <li key={step.label} className="flex items-center gap-3">
                    <span className="w-6 h-6 shrink-0 rounded-full bg-orange-500 text-white text-[10px] font-black flex items-center justify-center">
                      {i + 1}
                    </span>
                    <Link
                      href={step.href}
                      className="flex-1 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:text-primary transition-colors"
                    >
                      {step.label}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useDarkMode } from '@/hooks/useDarkMode';
import { fetchCurrentUser, logoutCurrentUser, type StoredUser } from '@/lib/clientAuth';
import SocialLinks from '@/components/layout/SocialLinks';

const NAV_LINKS = [
  { label: 'Accueil', href: '/' },
  { label: 'Offres d\'emploi', href: '/jobs' },
  { label: 'Stages', href: '/stages' },
  { label: 'Concours', href: '/concours' },
  { label: 'Bourse d\'études', href: '/bourses' },
  { label: 'Mon CV Pro', href: '/generateur-de-cv' },
  { label: 'Conseils', href: '/blog' },
];

export default function Header() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll);

    // Session réelle : lecture côté serveur (cookie httpOnly, rien à forger).
    let cancelled = false;
    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .finally(() => {
        if (!cancelled) setSessionLoading(false);
      });

    return () => {
      cancelled = true;
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  async function handleLogout() {
    await logoutCurrentUser();
    setUser(null);
    window.location.href = '/';
  }

  const dashboardHref = user?.role === 'company' ? '/dashboard/company' : '/dashboard/candidate';

  return (
    <header
      className={cn(
        'sticky top-0 z-50 transition-all duration-300 border-b',
        scrolled
          ? 'bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-border shadow-sm'
          : 'bg-white dark:bg-slate-900 border-transparent'
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 md:h-20">
          <Link href="/" className="flex items-center gap-2 group" aria-label="TravaillerEnCi — Accueil">
            <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-shadow">
              <span className="text-white font-black text-xl font-[var(--font-display)]">T</span>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black font-[var(--font-display)] tracking-tight leading-none drop-shadow-[0_1px_1px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)] transition-transform group-hover:scale-[1.02] origin-left">
                <span className="text-orange-500">Travailler</span>
                <span className="text-gray-900 dark:text-white">En</span>
                <span className="text-primary dark:text-emerald-400">Ci</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground -mt-0.5">
                L'emploi en Côte d'Ivoire
              </div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:text-primary hover:bg-primary/8 dark:hover:bg-slate-800/80 transition-all duration-200"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <Link
                href={dashboardHref}
                className="px-3 py-2 rounded-xl text-[13px] font-bold text-primary hover:bg-primary/8 dark:hover:bg-slate-800/80 transition-all duration-200"
              >
                Mon Tableau de Bord
              </Link>
            ) : null}
          </nav>

          <div className="hidden lg:flex items-center gap-2">
            {/* Recherche */}
            <Link
              href="/jobs"
              aria-label="Rechercher"
              className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </Link>
            {/* Réseaux sociaux */}
            <SocialLinks size="sm" className="gap-1.5 mr-1" />
            {/* Bouton Mode Sombre */}
            <button
              onClick={toggleDarkMode}
              aria-label="Basculer le mode sombre"
              className="p-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition-all duration-200"
            >
              {isDarkMode ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>

            {sessionLoading ? (
              <span className="w-24 h-9 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" aria-hidden="true" />
            ) : user ? (
              <>
                <Link
                  href={dashboardHref}
                  className="text-[13px] font-bold text-gray-800 dark:text-white px-3 py-2 bg-gray-100 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700"
                >
                  {user.name || user.email} ({user.role === 'company' ? 'Entreprise' : 'Candidat'})
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 hover:text-red-500 dark:hover:text-red-400 transition-all duration-200"
                >
                  Déconnexion
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:text-primary px-4 py-2 rounded-xl hover:bg-primary/5 transition-all duration-200"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="px-5 py-2.5 rounded-xl bg-primary text-white text-[13px] font-bold hover:bg-primary-dark hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] transition-all duration-200"
                >
                  S'inscrire
                </Link>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            {/* Recherche (compact sur mobile) */}
            <Link
              href="/jobs"
              aria-label="Rechercher"
              className="p-2 rounded-xl border border-border bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </Link>
            <button
              onClick={toggleDarkMode}
              aria-label="Basculer le mode sombre"
              className="p-2 rounded-xl border border-border bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300"
            >
              {isDarkMode ? (
                <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
            <button
              className="p-2"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
            >
              <svg className="w-6 h-6 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {open ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <div className="lg:hidden border-t border-gray-200 dark:border-slate-700 py-4 space-y-1.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 rounded-xl text-[13px] font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <Link
                href={dashboardHref}
                onClick={() => setOpen(false)}
                className="block px-4 py-3 rounded-xl bg-primary/5 text-[13px] font-bold text-primary hover:bg-primary/10 transition-colors"
              >
                Mon Tableau de Bord
              </Link>
            ) : null}
            <div className="pt-4 mt-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
              <SocialLinks size="md" className="justify-center gap-3 pt-1" />
              <div className="border-t border-gray-200 dark:border-slate-700" />
              <div className="space-y-2">
              {sessionLoading ? (
                <div className="h-10 rounded-xl bg-gray-100 dark:bg-slate-800 animate-pulse" aria-hidden="true" />
              ) : user ? (
                <>
                  <button
                    onClick={() => {
                      handleLogout();
                      setOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 transition-colors"
                  >
                    Déconnexion
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 rounded-xl text-[13px] font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 rounded-xl bg-primary text-white text-[13px] font-bold text-center shadow-md shadow-primary/20 active:scale-[0.98] transition-all"
                  >
                    Créer un compte
                  </Link>
                </>
              )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

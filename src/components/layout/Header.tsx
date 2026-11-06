'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useDarkMode } from '@/hooks/useDarkMode';
import { fetchCurrentUser, logoutCurrentUser, type StoredUser } from '@/lib/clientAuth';
import SocialLinks from '@/components/layout/SocialLinks';

const NAV_LINKS = [
  { label: 'Offres d’emploi', href: '/jobs' },
  { label: 'Stages', href: '/stages' },
  { label: 'Concours', href: '/concours' },
  { label: 'Bourses', href: '/bourses' },
  { label: 'Conseils', href: '/blog' },
];

const MOBILE_LINKS = [
  { label: 'Accueil', href: '/' },
  ...NAV_LINKS,
  { label: 'Mon CV Pro', href: '/generateur-de-cv' },
];

export default function Header() {
  const { isDarkMode, toggleDarkMode } = useDarkMode();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

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
  }, [pathname]);

  async function handleLogout() {
    await logoutCurrentUser();
    setUser(null);
    setOpen(false);
    router.push('/');
  }

  const dashboardHref = user?.role === 'company' ? '/dashboard/company' : '/dashboard/candidate';
  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b transition-colors duration-200',
        scrolled
          ? 'border-line bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95'
          : 'border-transparent bg-white dark:bg-slate-950',
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between gap-3 md:h-[4.5rem]">
          <Link
            href="/"
            className="group flex min-w-0 items-center gap-2.5"
            aria-label="TravaillerEnCi — Accueil"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-lg font-black text-white shadow-card transition-transform group-hover:scale-[1.03]">
              T
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-black leading-none tracking-tight text-ink dark:text-white sm:text-lg">
                TravaillerEn<span className="text-brand dark:text-brand-accent">Ci</span>
              </span>
              <span className="mt-1 hidden text-[9px] font-semibold uppercase tracking-[0.16em] text-muted dark:text-slate-400 sm:block">
                L’emploi en Côte d’Ivoire
              </span>
            </span>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Navigation principale">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors',
                  isActive(link.href)
                    ? 'bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-accent'
                    : 'text-ink-soft hover:bg-surface hover:text-brand dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-brand-accent',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-1.5 lg:flex">
            <Link
              href="/jobs#search-keyword"
              aria-label="Rechercher"
              title="Rechercher une offre"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink-soft transition-colors hover:border-brand/40 hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-brand-accent"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </Link>

            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label="Basculer le mode sombre"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink-soft transition-colors hover:border-brand/40 hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-brand-accent"
            >
              {isDarkMode ? (
                <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>

            {sessionLoading ? (
              <span className="h-10 w-36 animate-pulse rounded-lg bg-surface dark:bg-slate-800" aria-hidden="true" />
            ) : user ? (
              <>
                <Link
                  href={dashboardHref}
                  className="flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] font-bold text-ink transition-colors hover:border-brand/40 hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:text-brand-accent"
                >
                  {user.avatar_url ? (
                    <Image
                      src={user.avatar_url}
                      alt=""
                      width={24}
                      height={24}
                      unoptimized
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white">
                      {(user.name || user.email || '?')[0].toUpperCase()}
                    </span>
                  )}
                  <span className="whitespace-nowrap">Mon Tableau de Bord</span>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Déconnexion"
                  title="Déconnexion"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-white text-ink-soft transition-colors hover:border-danger/30 hover:text-danger dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-red-400"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <path d="m16 17 5-5-5-5" />
                    <path d="M21 12H9" />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-brand dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-brand-accent"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] font-bold text-ink transition-colors hover:border-brand/40 hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:text-brand-accent"
                >
                  S’inscrire
                </Link>
              </>
            )}

            <Link
              href="/publier-offre"
              aria-label="Publier une offre"
              className="flex h-10 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-bold text-white shadow-card transition-colors hover:bg-brand-strong"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden xl:inline">Publier une offre</span>
              <span className="xl:hidden">Publier</span>
            </Link>
          </div>

          <div className="flex items-center gap-1.5 lg:hidden">
            <Link
              href="/publier-offre"
              aria-label="Publier une offre"
              title="Publier une offre"
              className="flex h-11 items-center gap-1.5 rounded-xl bg-brand px-2.5 text-white shadow-card transition-colors hover:bg-brand-strong sm:px-3"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              <span className="hidden text-[13px] font-bold sm:inline">Publier</span>
            </Link>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-label="Menu"
              aria-expanded={open}
              aria-controls="mobile-menu"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-white text-ink-soft transition-colors hover:border-brand/40 hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-brand-accent"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {open ? (
                  <path d="M6 18 18 6M6 6l12 12" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {open ? (
          <div id="mobile-menu" className="border-t border-line pb-4 pt-3 dark:border-slate-800 lg:hidden">
            <nav className="grid grid-cols-2 gap-1" aria-label="Navigation mobile">
              {MOBILE_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex min-h-11 items-center rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors',
                    isActive(link.href)
                      ? 'bg-brand-soft text-brand-strong dark:bg-slate-800 dark:text-brand-accent'
                      : 'text-ink-soft hover:bg-surface hover:text-brand dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-brand-accent',
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <Link
              href="/publier-offre"
              onClick={() => setOpen(false)}
              className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-[13px] font-bold text-white shadow-card transition-colors hover:bg-brand-strong"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Publier une offre
            </Link>

            <div className="mt-3 border-t border-line pt-3 dark:border-slate-800">
              {sessionLoading ? (
                <div className="h-11 animate-pulse rounded-xl bg-surface dark:bg-slate-800" aria-hidden="true" />
              ) : user ? (
                <div className="space-y-1">
                  <Link
                    href={dashboardHref}
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-xl px-3 py-2.5 text-[13px] font-bold text-brand-strong hover:bg-brand-soft dark:text-brand-accent dark:hover:bg-slate-800"
                  >
                    Mon Tableau de Bord
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex min-h-11 w-full items-center rounded-xl px-3 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-red-50 hover:text-danger dark:text-slate-300 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                  >
                    Déconnexion
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-xl px-3 py-2.5 text-[13px] font-semibold text-ink-soft transition-colors hover:bg-surface hover:text-brand dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-brand-accent"
                  >
                    Connexion
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setOpen(false)}
                    className="flex min-h-11 items-center rounded-xl border border-line bg-white px-3 py-2.5 text-[13px] font-bold text-ink transition-colors hover:border-brand/40 hover:text-brand dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:text-brand-accent"
                  >
                    Créer un compte
                  </Link>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 dark:border-slate-800">
              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-[13px] font-semibold text-ink-soft transition-colors hover:text-brand dark:text-slate-300 dark:hover:text-brand-accent"
              >
                {isDarkMode ? (
                  <svg className="h-4 w-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                  </svg>
                )}
                {isDarkMode ? 'Mode clair' : 'Mode sombre'}
              </button>
              <SocialLinks size="sm" className="gap-1.5" />
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
}

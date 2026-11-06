'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

type NavKey = 'home' | 'jobs' | 'search' | 'saved' | 'profile';

const ITEMS: { key: NavKey; label: string; href: string }[] = [
  { key: 'home', label: 'Accueil', href: '/' },
  { key: 'jobs', label: 'Offres', href: '/jobs' },
  { key: 'search', label: 'Recherche', href: '/jobs#search-keyword' },
  { key: 'saved', label: 'Favoris', href: '/dashboard/candidate#favoris' },
  { key: 'profile', label: 'Profil', href: '/dashboard' },
];

function subscribeHash(callback: () => void) {
  window.addEventListener('hashchange', callback);
  return () => window.removeEventListener('hashchange', callback);
}

function readHash() {
  return window.location.hash;
}

function NavIcon({ name, className }: { name: NavKey; className?: string }) {
  const common = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="m3 10.5 9-7 9 7V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
      </svg>
    );
  }

  if (name === 'jobs') {
    return (
      <svg {...common}>
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" />
      </svg>
    );
  }

  if (name === 'search') {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    );
  }

  if (name === 'saved') {
    return (
      <svg {...common}>
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const hash = useSyncExternalStore(subscribeHash, readHash, () => '');

  const onJobs = pathname === '/jobs' || pathname.startsWith('/jobs/');
  const onDashboard = pathname === '/dashboard' || pathname.startsWith('/dashboard/');
  const searchActive = onJobs && hash === '#search-keyword';

  const active: Record<NavKey, boolean> = {
    home: pathname === '/',
    jobs: onJobs && !searchActive,
    search: searchActive,
    saved: onDashboard && hash === '#favoris',
    profile: onDashboard && hash !== '#favoris',
  };

  function handleSearchClick() {
    if (pathname !== '/jobs') return;
    window.requestAnimationFrame(() => {
      const input = document.getElementById('search-keyword');
      if (input instanceof HTMLInputElement) input.focus();
    });
  }

  return (
    <nav
      data-mobile-nav
      aria-label="Navigation principale mobile"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95 lg:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {ITEMS.map((item) => {
          const isActive = active[item.key];
          return (
            <li key={item.key} className="min-w-0">
              <Link
                href={item.href}
                onClick={item.key === 'search' ? handleSearchClick : undefined}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex h-full min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-semibold transition-colors',
                  isActive
                    ? 'text-brand dark:text-brand-accent'
                    : 'text-muted hover:text-brand dark:text-slate-400 dark:hover:text-brand-accent',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-10 items-center justify-center rounded-full transition-colors',
                    isActive && 'bg-brand-soft dark:bg-brand/15',
                  )}
                >
                  <NavIcon name={item.key} className="h-[19px] w-[19px]" />
                </span>
                <span className="max-w-full truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

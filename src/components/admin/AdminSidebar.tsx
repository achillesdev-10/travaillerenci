'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  {
    href: '/achilles',
    label: "Vue d'ensemble",
    description: 'KPIs, offres, scraper',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 13h8V3H3v10Z" />
        <path d="M13 21h8v-6h-8v6Z" />
        <path d="M13 3h8v8h-8V3Z" />
        <path d="M3 21h8v-4H3v4Z" />
      </svg>
    ),
  },
  {
    href: '/achilles/jobs',
    label: "Offres d'emploi",
    description: 'Modération & SEO',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
        <path d="M4 12h16" />
      </svg>
    ),
  },
  {
    href: '/achilles/exams',
    label: 'Concours',
    description: 'Modération des concours',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />
        <path d="M14 2v6h6" />
      </svg>
    ),
  },
  {
    href: '/achilles/recruiters',
    label: 'Offres Recruteurs',
    description: 'Modération self-service',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: '/achilles/analytics',
    label: 'Analytics',
    description: 'Visites & trafic',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="m7 14 4-4 3 3 5-6" />
      </svg>
    ),
  },
  {
    href: '/achilles/users',
    label: 'Utilisateurs',
    description: 'Candidats & entreprises',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        <circle cx="17.5" cy="9" r="2.5" />
        <path d="M16 14.6a5 5 0 0 1 5.5 5" />
      </svg>
    ),
  },
  {
    href: '/achilles/reports',
    label: 'Signalements',
    description: 'File de modération',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
    ),
  },
  {
    href: '/achilles/blog',
    label: 'Blog',
    description: 'Articles & publications',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    ),
  },
  {
    href: '/achilles/scraper',
    label: 'Scraper',
    description: 'Pilote des sources',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8V4" />
        <path d="m9 7 3-3 3 3" />
        <path d="M20 15a4 4 0 0 0-4-4h-1.3A6 6 0 1 0 6 17h10" />
        <path d="M16 19h6" />
        <path d="M19 16v6" />
      </svg>
    ),
  },
  {
    href: '/achilles/settings',
    label: 'Paramètres',
    description: 'Configuration',
    icon: (
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.9l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.9-.33 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.9.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .33-1.9 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.33-1.9l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.9.33h.01a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.01a1.7 1.7 0 0 0 1.9-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.33 1.9v.01a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z" />
      </svg>
    ),
  },
];

export default function AdminSidebar({
  email,
  onNavigate,
}: {
  email: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/admin/session', { method: 'DELETE' });
    onNavigate?.();
    router.replace('/achilles/login');
    router.refresh();
  }

  function handleNavigate() {
    onNavigate?.();
  }

  return (
    <aside className="flex h-full w-full flex-col border-r border-white/[0.06] bg-slate-950 text-white">
      {/* Brand */}
      <div className="border-b border-white/[0.06] px-6 py-6">
        <Link href="/achilles" onClick={handleNavigate} className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25">
            <span className="font-[var(--font-display)] text-xl font-black text-white">T</span>
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-950 bg-emerald-400" />
          </div>
          <div>
            <div className="font-[var(--font-display)] text-lg font-extrabold tracking-tight">
              <span className="text-orange-400">Travailler</span>
              <span className="text-white">En</span>
              <span className="text-emerald-400">Ci</span>
            </div>
            <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-400/80">
              Console Admin
            </div>
          </div>
        </Link>
      </div>

      {/* Session */}
      <div className="px-4 pt-5">
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Session</div>
          <div className="mt-1.5 truncate text-sm font-medium text-white">{email}</div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Administrateur
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-5 flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === '/achilles' ? pathname === item.href : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavigate}
              className={cn(
                'group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all',
                active
                  ? 'bg-white/[0.08] text-white'
                  : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-r-full bg-emerald-400" />
              )}
              <span
                className={cn(
                  'transition-colors',
                  active ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              >
                {item.icon}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className={cn('truncate', active && 'font-semibold')}>{item.label}</span>
                <span className="truncate text-[10px] text-slate-500 group-hover:text-slate-400">
                  {item.description}
                </span>
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-4 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-300 transition-colors hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="m16 17 5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
          Se déconnecter
        </button>
      </div>
    </aside>
  );
}

'use client';

/**
 *  TravaillerEnCi — ConcoursTabSection
 *  Wrapper client pour gérer les onglets Concours / Communiqués / Actus
 *  dans la page serveur /concours.
 *
 *  Reçoit l'onglet actif et les compteurs, affiche la navigation par onglets,
 *  et rend conditionnellement le `children` correspondant via un slot nommé.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { cn } from '@/lib/utils';

export type TabId = 'concours' | 'communiques' | 'actualites';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

const TABS: Tab[] = [
  {
    id: 'concours',
    label: 'Concours',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M16 13H8" />
        <path d="M16 17H8" />
        <path d="M10 9H8" />
      </svg>
    ),
  },
  {
    id: 'communiques',
    label: 'Communiqués',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10Z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    id: 'actualites',
    label: 'Guides & Actus',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
        <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
      </svg>
    ),
  },
];

interface ConcoursTabSectionProps {
  activeTab: string;
  counts?: Partial<Record<TabId, number>>;
  children: React.ReactNode;
}

export default function ConcoursTabSection({
  activeTab,
  counts,
  children,
}: ConcoursTabSectionProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function handleTabChange(tabId: TabId) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === 'concours') params.delete('tab');
    else params.set('tab', tabId);
    params.delete('page');
    const qs = params.toString();
    startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: true }));
  }

  return (
    <div>
      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="Sections concours"
        className={cn(
          'flex gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1 mb-6',
          isPending && 'pointer-events-none opacity-70',
        )}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[13px] font-semibold transition-all',
                isActive
                  ? 'bg-white dark:bg-slate-900 text-primary shadow-sm dark:text-emerald-400'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300',
              )}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {count !== undefined && count > 0 && (
                <span
                  className={cn(
                    'inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold',
                    isActive
                      ? 'bg-primary/10 text-primary dark:bg-emerald-400/15 dark:text-emerald-400'
                      : 'bg-gray-200/80 text-gray-500 dark:bg-slate-700 dark:text-gray-400',
                  )}
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content — server renders the correct tab via conditional children */}
      <div role="tabpanel">
        {children}
      </div>
    </div>
  );
}

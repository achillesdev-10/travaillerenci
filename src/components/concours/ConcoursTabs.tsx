'use client';

/**
 *  TravaillerEnCi — ConcoursTabs
 *  Système d'onglets pour structurer la page Concours en 3 sections :
 *   1. Concours en cours & à venir
 *   2. Communiqués officiels & Résultats
 *   3. Actualités & Guides de préparation
 *
 *  Navigation par onglets avec animation subtile, accessible (ARIA roles).
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';

export type ConcoursTabId = 'concours' | 'communiques' | 'actualites';

interface Tab {
  id: ConcoursTabId;
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

interface ConcoursTabsProps {
  /** Onglet actif initial. */
  defaultTab?: ConcoursTabId;
  /** Callback quand l'onglet change. */
  onTabChange?: (tab: ConcoursTabId) => void;
  /** Compteurs optionnels par onglet. */
  counts?: Partial<Record<ConcoursTabId, number>>;
  /** Contenu de chaque onglet. */
  children: React.ReactNode;
}

/** Expose un mapping tab → children index pour le rendu conditionnel. */
export function TabPanel({
  tabId,
  activeTab,
  children,
}: {
  tabId: ConcoursTabId;
  activeTab: ConcoursTabId;
  children: React.ReactNode;
}) {
  if (tabId !== activeTab) return null;
  return <div role="tabpanel" aria-labelledby={`tab-${tabId}`}>{children}</div>;
}

export default function ConcoursTabs({
  defaultTab = 'concours',
  onTabChange,
  counts,
  children,
}: ConcoursTabsProps) {
  const [activeTab, setActiveTab] = useState<ConcoursTabId>(defaultTab);

  function handleTabChange(tabId: ConcoursTabId) {
    setActiveTab(tabId);
    onTabChange?.(tabId);
  }

  return (
    <div>
      {/* Tab navigation */}
      <div
        role="tablist"
        aria-label="Sections concours"
        className="flex gap-1 rounded-xl bg-gray-100 dark:bg-slate-800 p-1 mb-6"
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = counts?.[tab.id];
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
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

      {/* Tab panels — render children directly, active tab filtering handled by parent */}
      <div id={`panel-${activeTab}`} role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
        {children}
      </div>
    </div>
  );
}

export { TABS };

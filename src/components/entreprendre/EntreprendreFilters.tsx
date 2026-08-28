'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useState } from 'react';
import type { EntreprendreSector, BudgetRange } from '@/types/entreprendre';

interface EntreprendreFiltersProps {
  sectors: Record<EntreprendreSector, string>;
  budgets: Record<BudgetRange, string>;
  currentSector?: string;
  currentBudget?: string;
}

export default function EntreprendreFilters({
  sectors,
  budgets,
  currentSector,
  currentBudget,
}: EntreprendreFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showFilters, setShowFilters] = useState(Boolean(currentSector || currentBudget));

  const updateFilter = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page'); // Reset page on filter change
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const clearAll = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  const hasFilters = Boolean(currentSector || currentBudget);

  return (
    <div className="bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-sm overflow-hidden">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setShowFilters((s) => !s)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="4" x2="4" y1="21" y2="14" />
            <line x1="4" x2="4" y1="10" y2="3" />
            <line x1="12" x2="12" y1="21" y2="12" />
            <line x1="12" x2="12" y1="8" y2="3" />
            <line x1="20" x2="20" y1="21" y2="16" />
            <line x1="20" x2="20" y1="12" y2="3" />
            <line x1="2" x2="6" y1="14" y2="14" />
            <line x1="10" x2="14" y1="8" y2="8" />
            <line x1="18" x2="22" y1="16" y2="16" />
          </svg>
          Filtrer par secteur ou budget
          {hasFilters && (
            <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold">
              {(currentSector ? 1 : 0) + (currentBudget ? 1 : 0)}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Filters content */}
      {showFilters && (
        <div className="px-5 pb-5 border-t border-border/50 pt-4 space-y-4">
          {/* Secteur */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Secteur d&apos;activité
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(sectors).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateFilter('sector', currentSector === key ? '' : key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    currentSector === key
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Budget */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              Budget de démarrage
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(budgets).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateFilter('budget', currentBudget === key ? '' : key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    currentBudget === key
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Clear */}
          {hasFilters && (
            <button
              type="button"
              onClick={clearAll}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
            >
              ✕ Effacer les filtres
            </button>
          )}
        </div>
      )}
    </div>
  );
}

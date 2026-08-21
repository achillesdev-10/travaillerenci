'use client';

/**
 *  TravaillerEnCi — ConcoursFilters
 *  Filtres dynamiques par listes déroulantes (select) pour la page /concours.
 *  Remplace les filtres pills par des selects ergonomiques pour :
 *   - Niveau de Diplôme (BEPC, BAC, Licence, Master, BEP/CAP…)
 *   - Catégorie / Secteur (Fonction Publique, Santé, Éducation…)
 *   - Statut (Lancement, En cours, Clôturé, Résultats disponibles)
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import {
  DIPLOMA_FILTERS,
  EXAM_CATEGORIES,
  EXAM_PHASE_LABEL,
} from '@/lib/examConstants';
import { cn } from '@/lib/utils';

interface ConcoursFiltersProps {
  initialDiploma?: string;
  initialCategory?: string;
  initialPhase?: string;
}

/** Options statut (phases métier). */
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Tous les statuts' },
  { value: 'upcoming', label: 'À venir (lancement)' },
  { value: 'open', label: 'Inscriptions ouvertes' },
  { value: 'ongoing', label: 'En cours' },
  { value: 'closed', label: 'Clôturé' },
  { value: 'results', label: 'Résultats disponibles' },
];

/** Options diplôme — dérivées des constantes existantes. */
const DIPLOMA_OPTIONS = [
  { value: '', label: 'Tous les niveaux' },
  ...DIPLOMA_FILTERS.map((d) => ({ value: d.value, label: d.label })),
];

/** Options catégorie — dérivées des constantes existantes. */
const CATEGORY_OPTIONS = [
  { value: '', label: 'Toutes les catégories' },
  ...EXAM_CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
];

export default function ConcoursFilters({
  initialDiploma = '',
  initialCategory = '',
  initialPhase = '',
}: ConcoursFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete('page'); // Reset pagination
    const qs = params.toString();
    startTransition(() => router.push(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: true }));
  }

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row gap-3 sm:gap-4',
        isPending && 'pointer-events-none opacity-70',
      )}
    >
      {/* Select : Diplôme */}
      <div className="relative flex-1 min-w-0">
        <label
          htmlFor="filter-diploma"
          className="mb-1 block text-[10.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500"
        >
          Diplôme
        </label>
        <div className="relative">
          <select
            id="filter-diploma"
            value={initialDiploma}
            onChange={(e) => updateParam('diploma', e.target.value)}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-[13px] font-semibold text-gray-700 outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:focus:border-primary/50"
          >
            {DIPLOMA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>

      {/* Select : Catégorie / Secteur */}
      <div className="relative flex-1 min-w-0">
        <label
          htmlFor="filter-category"
          className="mb-1 block text-[10.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500"
        >
          Catégorie
        </label>
        <div className="relative">
          <select
            id="filter-category"
            value={initialCategory}
            onChange={(e) => updateParam('category', e.target.value)}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-[13px] font-semibold text-gray-700 outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:focus:border-primary/50"
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>

      {/* Select : Statut */}
      <div className="relative flex-1 min-w-0">
        <label
          htmlFor="filter-status"
          className="mb-1 block text-[10.5px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500"
        >
          Statut
        </label>
        <div className="relative">
          <select
            id="filter-status"
            value={initialPhase}
            onChange={(e) => updateParam('phase', e.target.value)}
            className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-[13px] font-semibold text-gray-700 outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 dark:focus:border-primary/50"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );
}

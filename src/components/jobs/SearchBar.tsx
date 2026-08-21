'use client';

import { useState, useRef, useTransition, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { REGIONS_CI, JOB_TYPES } from '@/lib/constants';
import { cn, debounce } from '@/lib/utils';

interface SearchBarProps {
  compact?: boolean;
  className?: string;
  initialKeyword?: string;
  initialLocation?: string;
  initialContract?: string;
  onSearch?: (filters: { q: string; city: string; contract: string }) => void;
}

const CITY_OPTIONS = [
  { value: '', label: 'Toutes les villes' },
  ...REGIONS_CI.map((r) => ({ value: r.name, label: r.name })),
];

const CONTRACT_OPTIONS = [
  { value: '', label: 'Tous les contrats' },
  ...JOB_TYPES.map((t) => ({ value: t.value, label: t.label })),
];

export default function SearchBar({
  compact = false,
  className,
  initialKeyword = '',
  initialLocation = '',
  initialContract = '',
  onSearch,
}: SearchBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [keyword, setKeyword] = useState(initialKeyword);
  const [location, setLocation] = useState(initialLocation);
  const [contract, setContract] = useState(initialContract);
  const [isPending, startTransition] = useTransition();

  // ── Refs for values captured in the debounced callback ──────────────────
  // Les refs garantissent que le callback debounced a toujours accès aux
  // valeurs les plus récentes sans recréer la fonction (et donc sans casser
  // le timer du debounce à chaque render).
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const compactRef = useRef(compact);
  compactRef.current = compact;
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  // ── Debounced navigation — créé UNE SEULE FOIS ─────────────────────────
  // Sans useMemo, debounce() serait rappelé à chaque render : chaque render
  // créerait un nouveau timer, rendant le debounce totalement inefficace
  // (inondation de router.push au lieu d'un seul appel après 350ms).
  const pushFilters = useMemo(
    () =>
      debounce((q: string, c: string, ct: string) => {
        const params = new URLSearchParams(searchParamsRef.current.toString());
        if (q) params.set('q', q); else params.delete('q');
        if (c) params.set('city', c); else params.delete('city');
        if (ct) params.set('contract', ct); else params.delete('contract');
        params.delete('page');
        const next = `${pathnameRef.current}${params.toString() ? `?${params.toString()}` : ''}`;
        startTransition(() => router.push(next, { scroll: compactRef.current ? false : true }));
        if (onSearchRef.current) onSearchRef.current({ q, city: c, contract: ct });
      }, 350),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, startTransition],
  );

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    // Annule la navigation debounced en attente pour éviter une double
    // navigation (le submit gère lui-même l'URL avec les valeurs actuelles).
    pushFilters.cancel();
    const params = new URLSearchParams(searchParams.toString());
    if (keyword) params.set('q', keyword); else params.delete('q');
    if (location) params.set('city', location); else params.delete('city');
    if (contract) params.set('contract', contract); else params.delete('contract');
    params.delete('page');
    const next = `${pathname}${params.toString() ? `?${params.toString()}` : ''}`;
    startTransition(() => router.push(next, { scroll: !compact }));
    if (onSearch) onSearch({ q: keyword, city: location, contract });
  };

  return (
    <form
      onSubmit={submit}
      role="search"
      className={cn(
        'w-full bg-white border border-gray-100 rounded-2xl shadow-md shadow-black/5',
        compact ? 'p-3 sm:p-4' : 'p-4 sm:p-6',
        isPending && 'opacity-70 pointer-events-none',
        className
      )}
    >
      <div className={cn(
        'grid gap-3',
        compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-12'
      )}>
        <div className={cn(
          'relative flex items-stretch',
          compact ? '' : 'md:col-span-6'
        )}>
          <label htmlFor="search-keyword" className="sr-only">Mot-clé (poste, compétence, entreprise)</label>
          <span className="flex items-center justify-center pl-3 sm:pl-4 text-gray-400 pointer-events-none">
            <svg className="w-5 h-5 sm:w-[22px] sm:h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          </span>
          <input
            id="search-keyword"
            name="q"
            type="search"
            enterKeyHint="search"
            inputMode="search"
            placeholder={compact ? 'Poste, compétence…' : 'Ex: Développeur, Marketing, Data…'}
            autoComplete="off"
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value);
              pushFilters(e.target.value, location, contract);
            }}
            className="w-full pl-2 pr-3 sm:pl-3 sm:pr-4 py-3 sm:py-3.5 rounded-xl bg-gray-50/80 border border-transparent focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none text-sm sm:text-base placeholder:text-gray-400 transition-colors"
          />
        </div>

        <div className={cn('grid grid-cols-2 gap-2 sm:gap-3', compact ? '' : 'md:col-span-4')}>
          <div className="relative">
            <label htmlFor="search-city" className="sr-only">Ville / Localisation</label>
            <select
              id="search-city"
              name="city"
              value={location}
              onChange={(e) => {
                setLocation(e.target.value);
                pushFilters(keyword, e.target.value, contract);
              }}
              className="w-full appearance-none pl-10 sm:pl-11 pr-8 py-3 sm:py-3.5 rounded-xl bg-gray-50/80 border border-transparent focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none text-[13px] sm:text-sm text-gray-700"
            >
              {CITY_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-[18px] h-[18px] sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </span>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </div>

          <div className="relative">
            <label htmlFor="search-contract" className="sr-only">Type de contrat</label>
            <select
              id="search-contract"
              name="contract"
              value={contract}
              onChange={(e) => {
                setContract(e.target.value);
                pushFilters(keyword, location, e.target.value);
              }}
              className="w-full appearance-none pl-10 sm:pl-11 pr-8 py-3 sm:py-3.5 rounded-xl bg-gray-50/80 border border-transparent focus:bg-white focus:border-primary/40 focus:ring-2 focus:ring-primary/15 outline-none text-[13px] sm:text-sm text-gray-700"
            >
              {CONTRACT_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-[18px] h-[18px] sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M8 3v4" />
                <path d="M16 3v4" />
                <path d="M3 11h18" />
              </svg>
            </span>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </div>
        </div>

        <div className={cn(compact ? '' : 'md:col-span-2')}>
          <button
            type="submit"
            disabled={isPending}
            className="relative w-full inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-primary hover:bg-primary-dark active:bg-primary-dark/95 text-white font-semibold text-sm sm:text-base shadow-md shadow-primary/20 hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-60"
          >
            {isPending ? (
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-5 h-5 hidden sm:block" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            )}
            {isPending ? 'Recherche…' : (compact ? 'OK' : 'Rechercher')}
          </button>
        </div>
      </div>
    </form>
  );
}

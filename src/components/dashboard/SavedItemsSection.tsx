'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

interface SavedItem {
  item_type: 'job' | 'internship' | 'scholarship' | 'exam';
  item_id: string;
  saved_at: string;
  title: string;
  subtitle: string;
  url: string;
}

const TYPE_LABEL: Record<SavedItem['item_type'], string> = {
  job: 'Emplois',
  internship: 'Stages',
  scholarship: 'Bourses',
  exam: 'Concours',
};

const TYPE_ORDER: SavedItem['item_type'][] = ['job', 'internship', 'scholarship', 'exam'];

const TYPE_ACCENT: Record<SavedItem['item_type'], string> = {
  job: 'text-primary bg-primary/10',
  internship: 'text-blue-600 bg-blue-500/10 dark:text-blue-400',
  scholarship: 'text-amber-600 bg-amber-500/10 dark:text-amber-400',
  exam: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
};

/** Section « Mes sauvegardes » du dashboard candidat (groupée par type). */
export default function SavedItemsSection() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/saved', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data.items) ? data.items : []);
      }
    } catch {
      // silencieux — le dashboard reste utilisable
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(item: SavedItem) {
    const key = `${item.item_type}:${item.item_id}`;
    setRemoving(key);
    try {
      await fetch(
        `/api/saved?item_type=${item.item_type}&item_id=${encodeURIComponent(item.item_id)}`,
        { method: 'DELETE' },
      );
      setItems((prev) => prev.filter((i) => i.item_id !== item.item_id || i.item_type !== item.item_type));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold font-[var(--font-display)] text-gray-900 dark:text-white">
            Mes offres sauvegardées
          </h2>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
            Les opportunités que vous avez mises de côté, groupées par type.
          </p>
        </div>
        {loaded && items.length > 0 ? (
          <span className="shrink-0 rounded-full bg-amber-400/10 text-amber-600 dark:text-amber-400 px-3 py-1 text-[11px] font-bold">
            {items.length} sauvegarde{items.length > 1 ? 's' : ''}
          </span>
        ) : null}
      </div>

      {!loaded ? (
        <div className="py-10 text-center text-sm text-gray-400">Chargement…</div>
      ) : items.length === 0 ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-amber-400/10 text-amber-500 flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-md mx-auto mb-5">
            Cliquez sur l'étoile d'une offre d'emploi, d'un stage, d'une bourse ou d'un
            concours pour la retrouver ici — sans compte, elle vous redirigera vers la
            connexion.
          </p>
          <Link
            href="/jobs"
            className="inline-flex items-center gap-2 rounded-xl bg-primary hover:brightness-110 text-white px-5 py-3 text-xs font-bold shadow-lg shadow-primary/20 transition-all"
          >
            Parcourir les offres
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
      {TYPE_ORDER.map((type) => {
        const group = items.filter((i) => i.item_type === type);
        if (group.length === 0) return null;
        return (
          <div key={type}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-white">
              <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-[11px] font-bold ${TYPE_ACCENT[type]}`}>
                {TYPE_LABEL[type]}
              </span>
              <span className="text-gray-400 font-semibold">{group.length}</span>
            </h3>
            <ul className="space-y-2">
              {group.map((item) => (
                <li
                  key={`${item.item_type}:${item.item_id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 p-3.5 sm:p-4 transition-all hover:border-primary/25 hover:shadow-md"
                >
                  <Link href={item.url} className="flex-1 min-w-0">
                    <div className="font-bold text-[14px] text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[12px] text-gray-500 dark:text-slate-400 truncate mt-0.5">
                      {item.subtitle}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-1">
                      Sauvegardé le {formatDate(item.saved_at)}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={removing === `${item.item_type}:${item.item_id}`}
                    aria-label={`Retirer ${item.title} des sauvegardes`}
                    className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all disabled:opacity-50"
                  >
                    <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
        </div>
      )}
    </div>
  );
}

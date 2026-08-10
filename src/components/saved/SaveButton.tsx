'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser } from '@/lib/clientAuth';
import type { SavedItemType } from '@/services/savedItemsService';
import { cn } from '@/lib/utils';

interface SaveButtonProps {
  itemType: SavedItemType;
  itemId: string;
  /** 'button' = bouton complet (fiches détail), 'icon' = étoile compacte (cartes). */
  variant?: 'button' | 'icon';
  className?: string;
  label?: string;
}

/**
 * Bouton « Sauvegarder » (étoile). Non connecté → redirection vers /login avec
 * ?next=<chemin actuel> pour revenir sur la fiche après connexion (aucune
 * perte de contexte). Connecté → ajout / retrait de saved_items.
 *
 * Appelle toujours preventDefault/stopPropagation : utilisable à l'intérieur
 * d'un <Link> (cartes).
 */
export default function SaveButton({
  itemType,
  itemId,
  variant = 'button',
  className = '',
  label,
}: SaveButtonProps) {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

  // État initial (statut anonyme → false).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/saved/status?item_type=${itemType}&item_id=${encodeURIComponent(itemId)}`, {
      cache: 'no-store',
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setSaved(Boolean(data.saved));
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [itemType, itemId]);

  const handleClick = useCallback(
    async (e: React.MouseEvent) => {
      // Dans les cartes, le bouton est imbriqué dans un <Link> : on bloque la
      // navigation du lien, on gère uniquement la sauvegarde.
      e.preventDefault();
      e.stopPropagation();

      if (busy) return;

      setBusy(true);
      try {
        const user = await fetchCurrentUser();
        if (!user) {
          const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
          router.push(`/login?next=${encodeURIComponent(next)}`);
          return;
        }
      } finally {
        setBusy(false);
      }
      try {
        if (saved) {
          const res = await fetch(
            `/api/saved?item_type=${itemType}&item_id=${encodeURIComponent(itemId)}`,
            { method: 'DELETE' },
          );
          if (res.ok) setSaved(false);
        } else {
          const res = await fetch('/api/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_type: itemType, item_id: itemId }),
          });
          if (res.ok) setSaved(true);
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, saved, itemType, itemId, router],
  );

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || !checked}
        aria-label={saved ? 'Retirer des favoris' : 'Sauvegarder cette offre'}
        aria-pressed={saved}
        title={saved ? 'Retirer des favoris' : 'Sauvegarder'}
        className={cn(
          'inline-flex h-7 w-7 items-center justify-center rounded-full transition-all active:scale-90 disabled:opacity-50',
          saved
            ? 'bg-amber-400/15 text-amber-500'
            : 'bg-white text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:bg-slate-900 dark:hover:bg-slate-800',
          className,
        )}
      >
        <svg
          className={cn('h-4 w-4 transition-transform', saved && 'scale-110')}
          viewBox="0 0 24 24"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
        </svg>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || !checked}
      aria-pressed={saved}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-xs sm:text-sm font-bold transition-all active:scale-[0.99] disabled:opacity-50',
        saved
          ? 'border-amber-400/40 bg-amber-400/10 text-amber-600 dark:text-amber-400'
          : 'border-gray-200 bg-white text-gray-700 hover:border-amber-400/40 hover:text-amber-600 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200',
        className,
      )}
    >
      <svg
        className="h-4 w-4"
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
      {saved ? 'Sauvegardée' : (label ?? 'Sauvegarder')}
    </button>
  );
}

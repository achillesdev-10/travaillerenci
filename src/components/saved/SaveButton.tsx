'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { fetchCurrentUser, fetchCurrentUserCached } from '@/lib/clientAuth';
import type { SavedItemType } from '@/services/savedItemsService';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analyticsClient';

interface SaveButtonProps {
  itemType: SavedItemType;
  itemId: string;
  /** 'button' = bouton complet (fiches détail), 'icon' = étoile compacte (cartes). */
  variant?: 'button' | 'icon';
  className?: string;
  label?: string;
}

/**
 * Bouton « Sauvegarder » (étoile).
 * - Non connecté → invitation simple à créer un compte (§7), avec retour sur
 *   la fiche via ?next=<chemin actuel> : l'invitation est rendue dans un portail
 *   au niveau de <body> pour rester lisible à l'intérieur des cartes <Link>.
 * - Connecté → ajout / retrait de saved_items.
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
  /** Invitation « créez un compte » affichée aux visiteurs non connectés (§7). */
  const [invite, setInvite] = useState(false);

  // État initial (statut anonyme → false).
  // Optimisation : pour les visiteurs anonymes (majorité du trafic sur les
  // listings), on ne lance PAS /api/saved/status — une requête par carte
  // au chargement (l'API renvoie saved:false sans session de toute façon).
  useEffect(() => {
    let cancelled = false;
    fetchCurrentUserCached()
      .then((user) => {
        if (cancelled) return;
        if (!user) {
          setChecked(true);
          return;
        }
        return fetch(`/api/saved/status?item_type=${itemType}&item_id=${encodeURIComponent(itemId)}`, {
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
      })
      .catch(() => {
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
          // §7 — visiteur : on n'enregistre rien, on invite d'abord à créer
          // un compte (le parcours reste un clic, avec retour possible).
          setInvite(true);
          return;
        }
      } finally {
        setBusy(false);
      }
      setInvite(false);
      try {
        if (saved) {
          const res = await fetch(
            `/api/saved?item_type=${itemType}&item_id=${encodeURIComponent(itemId)}`,
            { method: 'DELETE' },
          );
          if (res.ok) {
            setSaved(false);
            trackEvent('job_unsave', { label: itemId });
          }
        } else {
          const res = await fetch('/api/saved', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_type: itemType, item_id: itemId }),
          });
          if (res.ok) {
            setSaved(true);
            trackEvent('job_save', { label: itemId });
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [busy, saved, itemType, itemId],
  );

  // Renvoi vers l'authentification en conservant la page en cours.
  const nextPath =
    typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';

  // Invitation hors flux (portail <body>) : reste lisible dans les cartes <Link>.
  const invitePortal =
    invite && typeof document !== 'undefined'
      ? createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed inset-x-4 bottom-4 z-[70] mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-amber-400/50 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ❤️
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Créez gratuitement votre compte pour sauvegarder cette offre.
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push('/register')}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white transition-all hover:brightness-110"
                >
                  Créer mon compte
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/login?next=${encodeURIComponent(nextPath)}`)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-gray-200"
                >
                  J&apos;ai déjà un compte
                </button>
                <button
                  type="button"
                  onClick={() => setInvite(false)}
                  aria-label="Fermer l'invitation"
                  className="ml-auto rounded-lg px-2 py-1 text-xs text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  if (variant === 'icon') {
    return (
      <>
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
        {invitePortal}
      </>
    );
  }

  return (
    <>
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
      {invitePortal}
    </>
  );
}

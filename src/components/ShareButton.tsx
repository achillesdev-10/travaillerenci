'use client';

import { useState, useCallback } from 'react';

interface ShareButtonProps {
  title: string;
  text: string;
  url?: string;
  /** Show icon only (compact) or icon + label */
  variant?: 'icon' | 'default';
  className?: string;
}

/**
 * Composant de partage réutilisable.
 * - Si navigator.share est supporté (mobile / PWA) → partage natif.
 * - Sinon (desktop) → copie l'URL dans le presse-papier avec toast de confirmation.
 */
export default function ShareButton({
  title,
  text,
  url,
  variant = 'default',
  className = '',
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const handleShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: shareUrl });
      } catch {
        // L'utilisateur a annulé le partage — pas d'erreur à afficher.
      }
    } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      } catch {
        // Fallback silencieux si clipboard API non disponible.
      }
    }
  }, [title, text, shareUrl]);

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex items-center gap-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all font-semibold text-xs sm:text-sm px-4 py-2.5 shadow-sm hover:shadow ${className}`}
    >
      {/* Icône Share2 (style Lucide) */}
      <svg
        className="w-4 h-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
        <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
      </svg>
      {variant === 'default' && (
        <span>{copied ? 'Lien copié !' : 'Partager'}</span>
      )}
    </button>
  );
}

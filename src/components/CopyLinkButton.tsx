'use client';

import { useState, useCallback } from 'react';
import { buildShareUrl } from '@/lib/shareUtm';
import { trackEvent } from '@/lib/analyticsClient';

interface CopyLinkButtonProps {
  url: string;
  /** Identifiant de campagne UTM (type d'objet partagé). */
  campaign?: string;
  className?: string;
}

/**
 * Bouton « Copier le lien » (§15) : copie l'URL partagée (avec UTM §21) dans
 * le presse-papier et confirme visuellement. Complémentaire du partage natif
 * (ShareButton), qui n'offre pas de copie sur mobile.
 */
export default function CopyLinkButton({
  url,
  campaign = 'contenu',
  className = '',
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const target = buildShareUrl(
      url,
      campaign,
      typeof window !== 'undefined' ? window.location.origin : undefined,
    );
    try {
      await navigator.clipboard.writeText(target);
      trackEvent('share', { label: `${campaign}:copie` });
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Presse-papier indisponible : on ne bloque pas l'utilisateur.
      setCopied(false);
    }
  }, [url, campaign]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={`inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-gray-700 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 ${className}`}
    >
      <svg
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      {copied ? 'Lien copié !' : 'Copier le lien'}
    </button>
  );
}

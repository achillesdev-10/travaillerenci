'use client';

import { useEffect } from 'react';
import { trackEvent, type TrackPayload } from '@/lib/analyticsClient';
import type { AnalyticsEventName } from '@/lib/analyticsEvents';

/**
 * Émet un événement analytics au montage (ex : `job_view`).
 * Non bloquant : si l'envoi échoue, la page n'est pas affectée.
 */
export function EventTracker({
  event,
  label,
}: {
  event: AnalyticsEventName;
  label?: string;
}) {
  useEffect(() => {
    trackEvent(event, { label });
  }, [event, label]);
  return null;
}

/**
 * Suit les clics sur les boutons de candidature : balisez les liens avec
 * `data-apply="application_click"` (attribut rendu côté serveur).
 *
 * On délègue l'écoute au document pour ne pas rendre l'analytics un
 * composant enfant de chaque variante de bouton.
 */
export function ApplicationClickTracker() {
  useEffect(() => {
    function onClick(event: MouseEvent) {
      const target = event.target as Element | null;
      const anchor = target?.closest?.('a[data-apply]') as HTMLAnchorElement | null;
      if (!anchor) return;
      const payload: TrackPayload = {
        label: anchor.getAttribute('data-apply') || undefined,
      };
      trackEvent('application_click', payload);
    }
    document.addEventListener('click', onClick, { passive: true });
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}

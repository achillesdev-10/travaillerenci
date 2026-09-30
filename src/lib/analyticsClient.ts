/**
 *  TravaillerEnCi — src/lib/analyticsClient.ts
 *
 *  Envoi « fire-and-forget » d'un événement analytics — ne bloque jamais
 *  l'interface et n'échoue jamais silencieusement en console.
 *
 *  Usage : trackEvent('job_save', { label: job.id })
 */

import type { AnalyticsEventName } from '@/lib/analyticsEvents';

export interface TrackPayload {
  /** Identifiant d'objet (id d'offre, id d'alerte…). */
  label?: string;
  path?: string;
}

export function trackEvent(event: AnalyticsEventName, payload: TrackPayload = {}): void {
  if (typeof window === 'undefined') return;
  try {
    void fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        label: payload.label ?? null,
        path: payload.path ?? window.location.pathname,
      }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // jamais d'erreur remontée : l'analytics ne doit pas dégrader l'UX
  }
}

/**
 *  TravaillerEnCi — src/lib/analyticsClient.ts
 *
 *  Envoi « fire-and-forget » d'un événement analytics — ne bloque jamais
 *  l'interface et n'échoue jamais silencieusement en console.
 *
 *  Usage : trackEvent('job_save', { label: job.id })
 *
 *  Perf CPU (Vercel) : les robots connus (navigateurs headless, clients
 *  HTTP de scripts, crawlers non filtrés en amont) ne déclenchent plus
 *  AUCUN fetch vers /api/analytics/track — la route reste un insert pur.
 *  La route garde aussi son garde-fou serveur (défense en profondeur).
 */

import type { AnalyticsEventName } from '@/lib/analyticsEvents';

export interface TrackPayload {
  /** Identifiant d'objet (id d'offre, id d'alerte…). */
  label?: string;
  path?: string;
}

/**
 * Détecte (côté client) les navigateurs robots connus via l'user-agent.
 * Liste volontairement conservatrice pour ne pas exclure de vrais visiteurs :
 * aucun navigateur grand public, ni même les navigateurs in-app
 * (WhatsApp, Facebook, Instagram), n'est filtré ici.
 */
export function isLikelyBot(): boolean {
  if (typeof navigator === 'undefined') return true;
  const ua = navigator.userAgent || '';
  return /bot\b|crawl|spider|slurp|lighthouse|curl|wget|python-requests|libwww|okhttp|go-http-client|java\/|httpclient|headlesschrome|phantomjs|puppeteer|playwright|selenium|axios/i.test(
    ua,
  );
}

export function trackEvent(event: AnalyticsEventName, payload: TrackPayload = {}): void {
  if (typeof window === 'undefined') return;
  try {
    // Perf CPU : pas d'invocation /api/analytics/track pour les robots connus.
    if (isLikelyBot()) return;
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

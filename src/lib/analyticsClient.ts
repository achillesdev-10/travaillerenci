/**
 *  TravaillerEnCi — src/lib/analyticsClient.ts
 *
 *  Envoi « fire-and-forget » des visites et événements analytics — ne bloque
 *  jamais l'interface et n'échoue jamais silencieusement en console.
 *
 *  Usage : trackEvent('job_save', { label: job.id })
 *
 *  Perf CPU (Vercel) : les envois sont regroupés en un seul POST
 *  /api/analytics/track (visites + événements), différé de 1,5 s. Un flush
 *  immédiat est déclenché toutes les 25 entrées et sur `pagehide` /
 *  `visibilitychange` via `navigator.sendBeacon`, pour ne pas perdre les
 *  actions suivies d'une navigation. Diviser par ~5 à 20 le nombre
 *  d'invocations de fonction par session visiteur.
 *
 *  Les robots connus ne déclenchent AUCUN fetch (la route garde aussi son
 *  garde-fou serveur, défense en profondeur).
 */

import type { AnalyticsEventName } from '@/lib/analyticsEvents';

export interface TrackPayload {
  /** Identifiant d'objet (id d'offre, id d'alerte…). */
  label?: string;
  path?: string;
}

type QueuedItem =
  | { kind: 'visit'; path: string; source: string }
  | { kind: 'event'; event: AnalyticsEventName; label: string | null; path: string };

const FLUSH_DELAY_MS = 1500;
const MAX_BATCH = 25;

let queue: QueuedItem[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

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

function bindLifecycle(): void {
  if (listenersBound || typeof window === 'undefined') return;
  listenersBound = true;
  window.addEventListener('pagehide', () => void flush(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush(true);
  });
}

function scheduleFlush(): void {
  bindLifecycle();
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush(false);
  }, FLUSH_DELAY_MS);
}

async function flush(useBeacon: boolean): Promise<void> {
  if (typeof window === 'undefined') return;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;

  // On vide la file avant l'envoi : un échec réseau ne doit pas provoquer de
  // retry en boucle (la mesure est perdue, l'UX jamais affectée).
  const items = queue;
  queue = [];
  const payload = JSON.stringify({ batch: items });

  try {
    if (useBeacon && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(
        '/api/analytics/track',
        new Blob([payload], { type: 'application/json' }),
      );
      return;
    }
    await fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // jamais d'erreur remontée : l'analytics ne doit pas dégrader l'UX
  }
}

function enqueue(item: QueuedItem): void {
  if (typeof window === 'undefined') return;
  if (isLikelyBot()) return;

  queue.push(item);
  if (queue.length >= MAX_BATCH) {
    void flush(false);
  } else {
    scheduleFlush();
  }
}

/** Enregistre une visite de page (regroupée avec les événements en attente). */
export function trackPageView(pagePath: string, source: string): void {
  enqueue({ kind: 'visit', path: pagePath, source });
}

export function trackEvent(event: AnalyticsEventName, payload: TrackPayload = {}): void {
  enqueue({
    kind: 'event',
    event,
    label: payload.label ?? null,
    path: payload.path ?? (typeof window !== 'undefined' ? window.location.pathname : '/'),
  });
}

/**
 *  TravaillerEnCi — src/services/social/providers/facebook.ts
 *  Publication sur la Page Facebook officielle (Graph API — méthode officielle
 *  uniquement : aucune simulation navigateur, aucun scraping, aucun cookie).
 *
 *  Le token (longue durée, Page) reste côté serveur dans FACEBOOK_ACCESS_TOKEN.
 *  Publication : POST /{page-id}/photos (image binaire + légende avec le lien).
 */

import { getFacebookConfig } from '../config';

export interface FacebookPublishResult {
  externalId: string;
  /** URL publique du post (si retournée par l'API). */
  permalink: string | null;
}

const GRAPH_URL = 'https://graph.facebook.com';
const GRAPH_VERSION = process.env.FACEBOOK_GRAPH_VERSION || 'v21.0';

export interface FacebookTestResult {
  ok: boolean;
  /** 'configured' | 'expired' | 'error' */
  state: 'configured' | 'expired' | 'error';
  detail: string;
}

/** Message d'erreur assaini (jamais de token / secret). */
function sanitizeError(message: string): string {
  return message
    .replace(/access_token=([^&\s]+)/g, 'access_token=***')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
    .slice(0, 500);
}

/**
 * Publie une photo avec légende sur la Page.
 * Retourne l'ID externe du post (post_id, sinon photo id).
 */
export async function publishFacebookPhoto(
  imageBuffer: Buffer,
  message: string,
): Promise<FacebookPublishResult> {
  const { pageId, accessToken } = getFacebookConfig();
  if (!pageId || !accessToken) {
    throw new Error('Facebook non configuré (FACEBOOK_PAGE_ID ou FACEBOOK_ACCESS_TOKEN manquant).');
  }

  const form = new FormData();
  // Buffer → Uint8Array pour satisfaire le type BlobPart (ArrayBufferView).
  form.append('source', new Blob([new Uint8Array(imageBuffer)], { type: 'image/png' }), 'travaillerenci.png');
  form.append('message', message);
  // Token dans le corps (jamais dans l'URL → jamais dans les logs).
  form.append('access_token', accessToken);

  const res = await fetch(`${GRAPH_URL}/${GRAPH_VERSION}/${pageId}/photos`, {
    method: 'POST',
    body: form,
  });

  const data = (await res.json().catch(() => null)) as {
    id?: string;
    post_id?: string;
    error?: { code?: number; message?: string; error_subcode?: number };
  } | null;

  if (!res.ok || !data) {
    const code = data?.error?.code;
    const message = data?.error?.message || `HTTP ${res.status}`;
    if (code === 190) {
      throw Object.assign(new Error(`Token Facebook invalide ou expiré (${sanitizeError(message)}).`), { code: 'TOKEN_EXPIRED' });
    }
    throw new Error(`Échec publication Facebook (${code || res.status}) : ${sanitizeError(message)}`);
  }

  return {
    externalId: data.post_id || data.id || '',
    permalink: null,
  };
}

/**
 * Vérifie la connexion à la Page (token + Page valides).
 * Aucun secret dans le retour.
 */
export async function testFacebookConnection(): Promise<FacebookTestResult> {
  const { pageId, accessToken } = getFacebookConfig();
  if (!pageId || !accessToken) {
    return { ok: false, state: 'error', detail: 'Non configuré' };
  }

  const res = await fetch(
    `${GRAPH_URL}/${GRAPH_VERSION}/${pageId}?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
    { method: 'GET' },
  );
  const data = (await res.json().catch(() => null)) as {
    id?: string;
    name?: string;
    error?: { code?: number; message?: string };
  } | null;

  if (res.ok && data?.id) {
    return { ok: true, state: 'configured', detail: data.name ? `Page « ${data.name} »` : 'Connecté' };
  }
  const code = data?.error?.code;
  if (code === 190) {
    return { ok: false, state: 'expired', detail: 'Token expiré ou révoqué — reconnectez la Page.' };
  }
  if (code === 100 || code === 803) {
    return { ok: false, state: 'error', detail: 'Page introuvable (FACEBOOK_PAGE_ID).' };
  }
  return {
    ok: false,
    state: 'error',
    detail: sanitizeError(data?.error?.message || `HTTP ${res.status}`),
  };
}

/**
 *  TravaillerEnCi — src/services/social/providers/linkedin.ts
 *  Publication sur la Page Organisation LinkedIn (Posts API — méthode
 *  officielle, permission `w_organization_social`).
 *
 *  IMPORTANT : tant que la destination fournie (linkedin.com/in/travailler-en-ci)
 *  n'est PAS démontrée comme étant une Page Organisation, l'intégration reste
 *  désactivée (LINKEDIN_ORGANIZATION_ID absent). Aucune supposition, aucun
 *  contournement. L'architecture s'active dès que la vraie Page est connectée.
 *
 *  Flux : initializeUpload → upload binaire → création du post (media + texte).
 */

import { getLinkedInConfig } from '../config';

export interface LinkedInPublishResult {
  externalId: string;
  permalink: string | null;
}

const API_BASE = 'https://api.linkedin.com';
const REST_PATH = '/rest';
const DEFAULT_VERSION = '202504';

export interface LinkedInTestResult {
  ok: boolean;
  /** 'configured' | 'expired' | 'error' */
  state: 'configured' | 'expired' | 'error';
  detail: string;
}

function sanitizeError(message: string): string {
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
    .slice(0, 500);
}

function orgUrn(organizationId: string): string {
  return `urn:li:organization:${organizationId}`;
}

function headers(token: string, withJson = true): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': process.env.LINKEDIN_API_VERSION || DEFAULT_VERSION,
    'X-Restli-Protocol-Version': '2.0.1',
  };
  if (withJson) h['Content-Type'] = 'application/json';
  return h;
}

async function initializeUpload(
  token: string,
  organizationId: string,
): Promise<{ uploadUrl: string; imageUrn: string }> {
  const res = await fetch(`${API_BASE}${REST_PATH}/images?action=initializeUpload`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: orgUrn(organizationId),
      },
    }),
  });

  const data = (await res.json().catch(() => null)) as {
    value?: { uploadUrl?: string; image?: string };
    message?: string;
    status?: number;
  } | null;

  if (!res.ok || !data?.value?.uploadUrl) {
    const status = res.status;
    const msg = sanitizeError(data?.message || `HTTP ${status}`);
    if (status === 401 || status === 403) {
      throw Object.assign(
        new Error(`Token LinkedIn invalide ou permission w_organization_social manquante (${msg}).`),
        { code: 'TOKEN_EXPIRED' },
      );
    }
    throw new Error(`Échec initialisation upload LinkedIn (${status}) : ${msg}`);
  }

  return { uploadUrl: data.value.uploadUrl, imageUrn: data.value.image || '' };
}

async function uploadImage(token: string, uploadUrl: string, imageBuffer: Buffer): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(imageBuffer),
  });
  if (!res.ok) {
    throw new Error(`Échec upload image LinkedIn (HTTP ${res.status}).`);
  }
}

async function createPost(
  token: string,
  organizationId: string,
  message: string,
  imageUrn: string,
  title: string,
): Promise<string> {
  const body = {
    author: orgUrn(organizationId),
    lifecycleState: 'PUBLISHED',
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
    commentary: message,
    distribution: {
      feedDistribution: 'MAIN_FEED',
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    content: {
      media: {
        id: imageUrn,
        title: { text: title.slice(0, 100) },
        altText: { text: `Offre ${title} sur TravaillerEnCi`.slice(0, 100) },
      },
    },
  };

  const res = await fetch(`${API_BASE}${REST_PATH}/posts`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string; status?: number } | null;
    const status = res.status;
    const msg = sanitizeError(data?.message || `HTTP ${status}`);
    if (status === 401 || status === 403) {
      throw Object.assign(
        new Error(`Token LinkedIn invalide ou permission manquante (${msg}).`),
        { code: 'TOKEN_EXPIRED' },
      );
    }
    throw new Error(`Échec création post LinkedIn (${status}) : ${msg}`);
  }

  // L'ID du post est renvoyé dans l'en-tête x-restli-id (URN).
  const restId = res.headers.get('x-restli-id');
  if (restId) return restId;
  const data = (await res.json().catch(() => null)) as { id?: string } | null;
  return data?.id || '';
}

/**
 * Publie une image + texte sur la Page Organisation.
 * Nécessite LINKEDIN_ORGANIZATION_ID (vraie Page) + LINKEDIN_ACCESS_TOKEN.
 */
export async function publishLinkedInPost(
  imageBuffer: Buffer,
  message: string,
  title: string,
): Promise<LinkedInPublishResult> {
  const { organizationId, accessToken } = getLinkedInConfig();
  if (!organizationId || !accessToken) {
    throw new Error('LinkedIn non configuré (LINKEDIN_ORGANIZATION_ID ou LINKEDIN_ACCESS_TOKEN manquant).');
  }

  const { uploadUrl, imageUrn } = await initializeUpload(accessToken, organizationId);
  await uploadImage(accessToken, uploadUrl, imageBuffer);
  const externalId = await createPost(accessToken, organizationId, message, imageUrn, title);

  return { externalId, permalink: null };
}

/**
 * Vérifie la connexion à la Page Organisation (token + permission
 * w_organization_social) via l'initialisation d'upload (aucun envoi réel).
 */
export async function testLinkedInConnection(): Promise<LinkedInTestResult> {
  const { organizationId, accessToken } = getLinkedInConfig();
  if (!organizationId || !accessToken) {
    return { ok: false, state: 'error', detail: 'Non configuré' };
  }
  try {
    await initializeUpload(accessToken, organizationId);
    return {
      ok: true,
      state: 'configured',
      detail: `Organisation ${organizationId} — permission w_organization_social active`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/TOKEN_EXPIRED/.test(message)) {
      return { ok: false, state: 'expired', detail: message };
    }
    return { ok: false, state: 'error', detail: message };
  }
}

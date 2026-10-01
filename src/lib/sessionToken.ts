/**
 *  TravaillerenCi — sessionToken.ts
 *
 *  Module PUR de création / vérification des jetons de session admin.
 *  Contrainte importante : NE PAS importer `next/headers` (ni toute autre
 *  dépendance Next.js) ici — ce module est utilisé à la fois côté Node
 *  (route handlers, server components) et côté Edge (middleware).
 *  Il ne repose que sur les primitives WebCrypto disponibles dans les
 *  deux environnements : crypto.subtle, TextEncoder, atob, btoa.
 */

export const ADMIN_SESSION_COOKIE = 'travaillerenci_admin_session';
export const LEGACY_ADMIN_SESSION_COOKIE = 'travaillerenci_admin_session';
export const SESSION_DURATION_HOURS = Number(
  process.env.ADMIN_SESSION_TTL_HOURS || 12
);

export interface AdminSession {
  email: string;
  role: 'admin';
  iat: number;
  exp: number;
}

export function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  // Fail-closed en production : sans secret, aucune session ne peut être
  // créée/vérifiée (la vérification attrape l'exception → null → 401).
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'ADMIN_SESSION_SECRET (ou JWT_SECRET) manquant : sessions désactivées en production.'
    );
  }
  return 'travaillerenci-admin-dev-secret';
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + padding);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function encodeBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function decodeBase64Url(value: string): string {
  return new TextDecoder().decode(base64UrlToBytes(value));
}

async function signValue(value: string): Promise<string> {
  const secret = new TextEncoder().encode(getSessionSecret());
  const key = await crypto.subtle.importKey(
    'raw',
    secret as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value) as unknown as BufferSource
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

async function verifySignature(value: string, signature: string): Promise<boolean> {
  const secret = new TextEncoder().encode(getSessionSecret());
  const key = await crypto.subtle.importKey(
    'raw',
    secret as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const sigBytes = base64UrlToBytes(signature);
  const dataBytes = new TextEncoder().encode(value);

  return crypto.subtle.verify(
    'HMAC',
    key,
    sigBytes as unknown as BufferSource,
    dataBytes as unknown as BufferSource
  );
}

export async function createAdminSessionToken(email: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSession = {
    email,
    role: 'admin',
    iat: now,
    exp: now + SESSION_DURATION_HOURS * 60 * 60,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifyAdminSessionToken(
  token?: string | null
): Promise<AdminSession | null> {
  if (!token) return null;

  // Tout jeton malformé (base64url invalide, mauvaise structure, JSON cassé,
  // signature invalide, expiré) doit retourner null et JAMAIS lever — sinon
  // un cookie corrompu ferait planter getAdminSession() côté serveur (500).
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const isValid = await verifySignature(payload, signature);
    if (!isValid) return null;

    const parsed = JSON.parse(decodeBase64Url(payload)) as AdminSession;
    if (parsed.role !== 'admin' || parsed.exp * 1000 <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Session UTILISATEUR (candidats & entreprises) — même mécanisme HMAC que la
// session admin, avec un cookie séparé et une durée plus longue (30 jours).
// -----------------------------------------------------------------------------

export const USER_SESSION_COOKIE = 'travaillerenci_session';
export const USER_SESSION_TTL_DAYS = 30;
export const USER_SESSION_TTL_SECONDS = USER_SESSION_TTL_DAYS * 24 * 60 * 60;

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: 'candidate' | 'company' | 'admin';
  iat: number;
  exp: number;
}

export async function createUserSessionToken(user: {
  id: string;
  email: string;
  name: string;
  role: UserSession['role'];
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: UserSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + USER_SESSION_TTL_SECONDS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = await signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export async function verifyUserSessionToken(
  token?: string | null
): Promise<UserSession | null> {
  if (!token) return null;

  // Même règle que la session admin : toute erreur → null, jamais d'exception.
  try {
    const [payload, signature] = token.split('.');
    if (!payload || !signature) return null;

    const isValid = await verifySignature(payload, signature);
    if (!isValid) return null;

    const parsed = JSON.parse(decodeBase64Url(payload)) as UserSession;
    if (!parsed.userId || parsed.exp * 1000 <= Date.now()) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

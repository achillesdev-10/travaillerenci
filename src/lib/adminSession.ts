import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse, type NextResponse as NextResponseType } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  SESSION_DURATION_HOURS,
  type AdminSession,
  createAdminSessionToken,
  verifyAdminSessionToken,
} from '@/lib/sessionToken';

// Ré-export du module pur (compatibilité avec les imports existants).
export {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  SESSION_DURATION_HOURS,
  type AdminSession,
  createAdminSessionToken,
  verifyAdminSessionToken,
};

function getExpectedAdminEmail(): string {
  return process.env.ADMIN_EMAIL || 'achillesdev10@gmail.com';
}

function getExpectedAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123456';
}

export function isAdminCredentialsConfigured(): boolean {
  return Boolean(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD);
}

export function getAdminCredentialHints() {
  return {
    email: getExpectedAdminEmail(),
    configured: isAdminCredentialsConfigured(),
    sessionDurationHours: SESSION_DURATION_HOURS,
  };
}

export async function validateAdminCredentials(
  email: string,
  password: string
): Promise<boolean> {
  return email === getExpectedAdminEmail() && password === getExpectedAdminPassword();
}

export async function getAdminSession(): Promise<AdminSession | null> {
  const cookieStore = await cookies();
  const token =
    cookieStore.get(ADMIN_SESSION_COOKIE)?.value ||
    cookieStore.get(LEGACY_ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export async function getAdminSessionFromRequest(
  request: NextRequest
): Promise<AdminSession | null> {
  const token =
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value ||
    request.cookies.get(LEGACY_ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export async function requireAdminSession(
  nextPath: string = '/cz7tk'
): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) {
    redirect(`/cz7tk/login?next=${encodeURIComponent(nextPath)}`);
  }
  return session;
}

/**
 * Helper centralisé pour les routes API admin.
 * Valide toujours la session (aucun bypass en développement).
 * Utilisation dans les route handlers :
 *   const auth = await requireAdminApi(request);
 *   if (auth.error) return auth.error;
 *   const { session } = auth;
 */
export async function requireAdminApi(request: NextRequest): Promise<
  | { session: AdminSession; error: undefined }
  | { session: undefined; error: NextResponseType }
> {
  const session = await getAdminSessionFromRequest(request);
  if (!session) {
    return {
      session: undefined,
      error: NextResponse.json(
        { error: 'Session administrateur invalide ou expirée.' },
        { status: 401 },
      ),
    };
  }
  return { session, error: undefined };
}

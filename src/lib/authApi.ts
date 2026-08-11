'use client';

/**
 *  TravaillerEnCi — src/lib/authApi.ts
 *  Appels client vers les routes /api/auth. La session est un cookie httpOnly
 *  posé par le serveur (register / login) : le navigateur l'envoie
 *  automatiquement sur les appels suivants, aucun état à stocker côté client.
 *
 *  Résultat discriminant :
 *    { ok: true, data }        → succès
 *    { ok: false, error }      → échec (message à afficher tel quel)
 */

export type AuthRole = 'candidate' | 'company';

type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function post<T>(url: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        error: typeof data.error === 'string' ? data.error : 'Une erreur est survenue.',
      };
    }
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, error: 'Serveur injoignable. Vérifiez votre connexion et réessayez.' };
  }
}

export function apiRegister(input: {
  email: string;
  name: string;
  password: string;
  role: AuthRole;
  /** Mini-profil optionnel (critères d'alertes). */
  city?: string;
  diploma?: string;
  sectors?: string[];
}) {
  return post<{
    user: {
      id: string;
      email: string;
      name: string;
      role: AuthRole;
      /** Faux quand la vérification d'email est ACTIVÉE (compte créé non vérifié). */
      email_verified: boolean;
    };
  }>('/api/auth/register', input);
}

/** Renvoie le lien de confirmation d'email à l'utilisateur connecté. */
export function apiResendVerification() {
  return post<{ ok: boolean; message?: string }>('/api/auth/resend-verification', {});
}

export function apiLogin(input: { email: string; password: string; role: AuthRole }) {
  return post<{ user: { id: string; email: string; name: string; role: AuthRole } }>(
    '/api/auth/login',
    input,
  );
}

export function apiForgotPassword(input: { email: string }) {
  return post<{ ok: boolean; message?: string }>('/api/auth/forgot-password', input);
}

export function apiResetPassword(input: { token: string; password: string }) {
  return post<{ ok: boolean; message?: string }>('/api/auth/reset-password', input);
}

export function apiMigrateLegacy(input: { email: string; name: string; role: AuthRole }) {
  return post<{
    migrated: boolean;
    reason?: string;
    user?: { id: string; email: string; name: string; role: AuthRole };
  }>('/api/auth/migrate-legacy', input);
}

export function apiSetPassword(input: { password: string }) {
  return post<{ ok: boolean; message?: string }>('/api/auth/set-password', input);
}

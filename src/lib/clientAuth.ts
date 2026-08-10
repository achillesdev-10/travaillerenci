'use client';

/**
 *  TravaillerEnCi — src/lib/clientAuth.ts
 *  Couche client de l'authentification RÉELLE.
 *
 *  Plus aucun stockage local simulé : la session est un cookie httpOnly
 *  signé (HMAC) posé par le serveur lors de /api/auth/register et
 *  /api/auth/login. Ces helpers ne font que lire / fermer cette session
 *  via les routes serveur — rien à forger côté navigateur.
 */

export type StoredUser = {
  id: string;
  email: string;
  role: 'candidate' | 'company' | 'admin';
  name: string;
  /** Vrai si le compte migré / Google n'a pas encore de mot de passe défini. */
  needs_password_reset?: boolean;
  /** Vrai si l'email a été confirmé. */
  email_verified?: boolean;
};

/** Récupère l'utilisateur connecté depuis le serveur (cookie httpOnly). */
export async function fetchCurrentUser(): Promise<StoredUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: StoredUser | null };
    return data.user;
  } catch {
    return null;
  }
}

/** Déconnecte côté serveur (supprime le cookie httpOnly). */
export async function logoutCurrentUser(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    });
  } catch {
    // La déconnexion locale reste effective même en cas d'erreur réseau.
  }
}

// -----------------------------------------------------------------------------
// Migration des anciens comptes simulés (localStorage)
// -----------------------------------------------------------------------------

/** Clés localStorage de l'ancienne authentification simulée. */
export const LEGACY_USER_KEY = 'travaillerenci_user';
export const LEGACY_AUTH_STATE_KEY = 'travaillerenci_auth_state';

/**
 * Extrait un compte depuis l'ancien stockage local simulé.
 * Formats supportés :
 *   • traivaillerenci_user  → { email, role, name }
 *   • travaillerenci_auth_state → { user: { email, role, first_name, last_name } }
 */
export function readLegacyAccount(): {
  email: string;
  name: string;
  role: 'candidate' | 'company';
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawUser = localStorage.getItem(LEGACY_USER_KEY);
    if (rawUser) {
      const parsed = JSON.parse(rawUser) as {
        email?: string;
        role?: string;
        name?: string;
      };
      const email = typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '';
      if (!email) return null;
      return {
        email,
        role: parsed.role === 'company' ? 'company' : 'candidate',
        name: typeof parsed.name === 'string' && parsed.name ? parsed.name : email.split('@')[0],
      };
    }

    const rawState = localStorage.getItem(LEGACY_AUTH_STATE_KEY);
    if (rawState) {
      const parsed = JSON.parse(rawState) as {
        user?: { email?: string; role?: string; first_name?: string; last_name?: string };
      };
      if (!parsed.user) return null;
      const legacyUser = parsed.user;
      const email =
        typeof legacyUser.email === 'string' ? legacyUser.email.trim().toLowerCase() : '';
      if (!email) return null;
      const role =
        legacyUser.role === 'employer' || legacyUser.role === 'company' ? 'company' : 'candidate';
      const name = [legacyUser.first_name, legacyUser.last_name]
        .filter(Boolean)
        .join(' ')
        .trim();
      return {
        email,
        role,
        name: name || email.split('@')[0],
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Supprime les clés localStorage de l'ancienne auth simulée. */
export function clearLegacyAuthKeys(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_USER_KEY);
    localStorage.removeItem(LEGACY_AUTH_STATE_KEY);
  } catch {
    // non bloquant
  }
}

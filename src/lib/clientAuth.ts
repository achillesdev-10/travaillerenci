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

import { hasSessionFlagCookie } from '@/lib/sessionFlag';

export type StoredUser = {
  id: string;
  email: string;
  role: 'candidate' | 'company' | 'admin';
  name: string;
  /** Vrai si le compte migré / Google n'a pas encore de mot de passe défini. */
  needs_password_reset?: boolean;
  /** Vrai si l'email a été confirmé. */
  email_verified?: boolean;
  /** URL de la photo de profil. */
  avatar_url?: string | null;
};

/** Clé sessionStorage : cache de session pour la durée de l'onglet. */
const USER_SESSION_STORAGE_KEY = 'te_me_user';

/** Durée de validité du cache sessionStorage (au-delà → revalidation serveur). */
const USER_CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Récupère l'utilisateur connecté depuis le serveur (cookie httpOnly).
 *
 * Perf CPU : l'appel réseau n'est fait que si le drapeau NON sensible
 * `te_session=1` est présent (posé à la connexion, supprimé à la
 * déconnexion). Pour les visiteurs anonymes (la majorité du trafic),
 * retour immédiat de null sans invoquer /api/auth/me. Le résultat est
 * ensuite mis en sessionStorage pour la durée de l'onglet (TTL de
 * 30 min par prudence : nom/avatar/email vérifiables au rechargement).
 */
export async function fetchCurrentUser(force = false): Promise<StoredUser | null> {
  if (!hasSessionFlagCookie()) {
    // Pas de session → on purge le cache et on retourne immédiatement.
    persistCachedUser(null);
    return null;
  }

  if (!force && inflightUser) return inflightUser;
  if (!force) {
    const cached = readCachedFreshUser();
    if (cached) return cached;
  }

  const request = fetchCurrentUserFromServer().finally(() => {
    inflightUser = null;
  });
  if (!force) inflightUser = request;
  return request;
}

/** Promesse partagée : plusieurs composants au montage → un seul appel réseau. */
let inflightUser: Promise<StoredUser | null> | null = null;

async function fetchCurrentUserFromServer(): Promise<StoredUser | null> {
  try {
    const res = await fetch('/api/auth/me', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) {
      persistCachedUser(null);
      return null;
    }
    const data = (await res.json()) as { user: StoredUser | null };
    persistCachedUser(data.user);
    return data.user;
  } catch {
    return null;
  }
}

/** Lit le cache sessionStorage si l'entrée existe et est fraîche. */
function readCachedFreshUser(): StoredUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(USER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user: StoredUser | null; at: number };
    if (!parsed?.user) {
      sessionStorage.removeItem(USER_SESSION_STORAGE_KEY);
      return null;
    }
    if (Date.now() - parsed.at > USER_CACHE_TTL_MS) return null;
    return parsed.user;
  } catch {
    return null;
  }
}

/**
 * Écrit/supprime le cache sessionStorage de la session. Ne stocke que le
 * profil PUBLIC déjà affiché dans le Header (id, email, nom, rôle, avatar)
 * — rien de secret : la vraie session reste un cookie httpOnly côté serveur.
 * Utilisé aussi après login/inscription (la réponse a déjà le user).
 */
export function persistCachedUser(user: StoredUser | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (user) {
      sessionStorage.setItem(
        USER_SESSION_STORAGE_KEY,
        JSON.stringify({ user, at: Date.now() }),
      );
    } else {
      sessionStorage.removeItem(USER_SESSION_STORAGE_KEY);
    }
  } catch {
    // sessionStorage indisponible (navigation privée stricte) : non bloquant,
    // les pages rechargeront leur session depuis le serveur (drapeau présent).
  }
}

/** Déconnecte côté serveur (supprime le cookie httpOnly ET le drapeau). */
export async function logoutCurrentUser(): Promise<void> {
  persistCachedUser(null);
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
// Session partagée en cache
// -----------------------------------------------------------------------------

/**
 * Version en cache de fetchCurrentUser.
 *
 * Utilisée par les composants répétés (bouton « Sauvegarder » sur chaque
 * carte d'offre) : fetchCurrentUser dédoublonne déjà les appels simultanés
 * (promesse partagée), met le résultat en sessionStorage pour l'onglet et
 * court-circuite le réseau pour les visiteurs anonymes (drapeau absent).
 */
export function fetchCurrentUserCached(): Promise<StoredUser | null> {
  return fetchCurrentUser();
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

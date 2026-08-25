'use client';

/**
 *  TravaillerEnCi — src/hooks/useAuth.ts
 *
 *  Hook React côté client pour l'authentification.
 *  Expose : user, profile, loading, signIn, signUp, signOut, refresh.
 *
 *  La session est gérée par un cookie httpOnly posé par le serveur.
 *  Ce hook lit l'état via /api/auth/me et délègue les mutations aux
 *  routes /api/auth/login, /api/auth/register, /api/auth/logout.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  apiLogin,
  apiRegister,
  apiForgotPassword,
  apiResetPassword,
  apiResendVerification,
  type AuthRole,
} from '@/lib/authApi';
import {
  fetchCurrentUser,
  logoutCurrentUser,
  type StoredUser,
} from '@/lib/clientAuth';

// Re-export des types utiles
export type { AuthRole } from '@/lib/authApi';
export type { StoredUser };

export interface UseAuthReturn {
  /** Utilisateur connecté (null si non connecté ou en cours de chargement). */
  user: StoredUser | null;
  /** Vrai tant que la session n'est pas résolue. */
  loading: boolean;
  /** Vrai si l'utilisateur est connecté. */
  isAuthenticated: boolean;

  /** Connexion (email + mot de passe). Redirige selon le rôle. */
  signIn: (input: {
    email: string;
    password: string;
    role?: AuthRole;
  }) => Promise<{ ok: boolean; error?: string; role?: string }>;

  /** Inscription (candidat ou entreprise). */
  signUp: (input: {
    email: string;
    name: string;
    password: string;
    role: AuthRole;
    city?: string;
    diploma?: string;
    sectors?: string[];
  }) => Promise<{ ok: boolean; error?: string; email_verified?: boolean }>;

  /** Déconnexion (supprime le cookie httpOnly côté serveur). */
  signOut: () => Promise<void>;

  /** Force le rechargement de la session depuis le serveur. */
  refresh: () => Promise<void>;

  /** Demande de réinitialisation de mot de passe (envoie un email). */
  forgotPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;

  /** Réinitialisation du mot de passe (avec jeton). */
  resetPassword: (
    token: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;

  /** Renvoie le lien de vérification d'email. */
  resendVerification: () => Promise<{ ok: boolean; error?: string; message?: string }>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<StoredUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Chargement initial de la session
  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const current = await fetchCurrentUser();
      setUser(current);
    } finally {
      setLoading(false);
    }
  }, []);

  const signIn = useCallback(
    async (input: {
      email: string;
      password: string;
      role?: AuthRole;
    }) => {
      const result = await apiLogin({
        email: input.email,
        password: input.password,
        role: input.role ?? 'candidate',
      });

      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }

      // Session posée par le serveur → on recharge l'état côté client.
      setUser(result.data.user);
      return {
        ok: true as const,
        role: result.data.user.role,
      };
    },
    [],
  );

  const signUp = useCallback(
    async (input: {
      email: string;
      name: string;
      password: string;
      role: AuthRole;
      city?: string;
      diploma?: string;
      sectors?: string[];
    }) => {
      const result = await apiRegister(input);

      if (!result.ok) {
        return { ok: false as const, error: result.error };
      }

      // Si la vérification d'email est activée, le compte est créé non vérifié.
      if (result.data.user.email_verified === false) {
        return { ok: true as const, email_verified: false };
      }

      // Sinon, la session est active → on met à jour l'état.
      setUser(result.data.user);
      return { ok: true as const, email_verified: true };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await logoutCurrentUser();
    setUser(null);
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    const result = await apiForgotPassword({ email });
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    return { ok: true as const };
  }, []);

  const resetPassword = useCallback(async (token: string, password: string) => {
    const result = await apiResetPassword({ token, password });
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    return { ok: true as const };
  }, []);

  const resendVerification = useCallback(async () => {
    const result = await apiResendVerification();
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    return { ok: true as const, message: result.data.message };
  }, []);

  return {
    user,
    loading,
    isAuthenticated: !loading && user !== null,
    signIn,
    signUp,
    signOut,
    refresh,
    forgotPassword,
    resetPassword,
    resendVerification,
  };
}

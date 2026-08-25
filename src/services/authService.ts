/**
 *  TravaillerEnCi — src/services/authService.ts
 *
 *  Couche d'abstraction unifiée pour l'authentification.
 *  Bascule automatiquement entre :
 *    • Supabase Auth (production, NEXT_PUBLIC_DB_PROVIDER=supabase)
 *    • Auth locale SQLite (développement, NEXT_PUBLIC_DB_PROVIDER=sqlite)
 *
 *  Les composants React n'appellent JAMAIS Supabase directement :
 *  ils passent toujours par ce module. La logique côté serveur (routes API,
 *  server components) peut aussi l'utiliser via les fonctions asynchrones.
 */

import { getDatabaseConfig } from '@/lib/config';
import { isSupabaseConfigured } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types partagés
// ---------------------------------------------------------------------------

export type AuthRole = 'candidate' | 'company' | 'admin';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
  needs_password_reset: boolean;
  email_verified: boolean;
  created_at: string;
}

export interface SignInInput {
  email: string;
  password: string;
  role?: AuthRole;
}

export interface SignUpInput {
  email: string;
  name: string;
  password: string;
  role: AuthRole;
  city?: string;
  diploma?: string;
  sectors?: string[];
}

export interface AuthResult<T = AuthUser> {
  ok: true;
  data: T;
}

export interface AuthError {
  ok: false;
  error: string;
}

export type AuthResponse<T = AuthUser> = AuthResult<T> | AuthError;

// ---------------------------------------------------------------------------
// Détection du fournisseur
// ---------------------------------------------------------------------------

/** Vrai si on doit utiliser Supabase Auth (production). */
export function isSupabaseAuthMode(): boolean {
  const { provider } = getDatabaseConfig();
  return provider === 'supabase' && isSupabaseConfigured();
}

// ---------------------------------------------------------------------------
// Fonctions serveur (à appeler depuis les routes API ou server components)
// ---------------------------------------------------------------------------

/**
 * Crée un compte utilisateur. Retourne l'utilisateur public, ou null si
 * l'email existe déjà.
 *
 * Chemin SQLite : délègue à createUser du userRepository.
 * Chemin Supabase : crée dans auth.users + profiles via service_role.
 */
export async function createAuthUser(input: {
  email: string;
  name: string;
  role: AuthRole;
  passwordHash: string;
  googleSub?: string;
  needsPasswordReset?: boolean;
  emailVerified?: boolean;
}): Promise<AuthUser | null> {
  if (isSupabaseAuthMode()) {
    return createSupabaseAuthUser(input);
  }
  return createLocalAuthUser(input);
}

/** Auth locale : délègue au userRepository existant. */
async function createLocalAuthUser(input: {
  email: string;
  name: string;
  role: AuthRole;
  passwordHash: string;
  googleSub?: string;
  needsPasswordReset?: boolean;
  emailVerified?: boolean;
}): Promise<AuthUser | null> {
  const { createUser } = await import('@/lib/userRepository');
  const user = await createUser({
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash: input.passwordHash,
    googleSub: input.googleSub,
    needsPasswordReset: input.needsPasswordReset,
    emailVerified: input.emailVerified,
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthRole,
    needs_password_reset: user.needs_password_reset,
    email_verified: user.email_verified,
    created_at: user.created_at,
  };
}

/**
 * Auth Supabase : crée l'utilisateur dans la table `users` (pas dans
 * auth.users — on garde notre propre gestion des mots de passe pour
 * rester compatible avec le mode SQLite). La table `users` dans Supabase
 * est la source de vérité dans les deux modes.
 *
 * NOTE : si on veut utiliser Supabase Auth (auth.signUp) à l'avenir, on
 * pourra migrer — mais ça briserait la compatibilité avec le schéma SQLite.
 * Pour l'instant, on garde le schéma unifié `users` table.
 */
async function createSupabaseAuthUser(input: {
  email: string;
  name: string;
  role: AuthRole;
  passwordHash: string;
  googleSub?: string;
  needsPasswordReset?: boolean;
  emailVerified?: boolean;
}): Promise<AuthUser | null> {
  const { createUser } = await import('@/lib/userRepository');
  const user = await createUser({
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash: input.passwordHash,
    googleSub: input.googleSub,
    needsPasswordReset: input.needsPasswordReset,
    emailVerified: input.emailVerified,
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthRole,
    needs_password_reset: user.needs_password_reset,
    email_verified: user.email_verified,
    created_at: user.created_at,
  };
}

/**
 * Vérifie les identifiants de connexion et retourne l'utilisateur public.
 * Retourne null si l'email n'existe pas ou le mot de passe est incorrect.
 */
export async function verifyAuthCredentials(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const { findUserByEmail, toPublic } = await import('@/lib/userRepository');
  const { verifyPassword } = await import('@/lib/password');

  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  const publicUser = toPublic(user);
  return {
    id: publicUser.id,
    email: publicUser.email,
    name: publicUser.name,
    role: publicUser.role as AuthRole,
    needs_password_reset: publicUser.needs_password_reset,
    email_verified: publicUser.email_verified,
    created_at: publicUser.created_at,
  };
}

/**
 * Récupère un utilisateur par son email.
 */
export async function getAuthUserByEmail(email: string): Promise<AuthUser | null> {
  const { findUserByEmail, toPublic } = await import('@/lib/userRepository');
  const user = await findUserByEmail(email);
  if (!user) return null;
  const publicUser = toPublic(user);
  return {
    id: publicUser.id,
    email: publicUser.email,
    name: publicUser.name,
    role: publicUser.role as AuthRole,
    needs_password_reset: publicUser.needs_password_reset,
    email_verified: publicUser.email_verified,
    created_at: publicUser.created_at,
  };
}

/**
 * Récupère un utilisateur par son ID.
 */
export async function getAuthUserById(userId: string): Promise<AuthUser | null> {
  if (isSupabaseAuthMode()) {
    const { getSupabaseClient } = await import('@/lib/supabase');
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from('users')
      .select('id,email,name,role,needs_password_reset,email_verified,created_at')
      .eq('id', userId)
      .maybeSingle();
    if (!data) return null;
    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role as AuthRole,
      needs_password_reset: Boolean(data.needs_password_reset),
      email_verified: Boolean(data.email_verified),
      created_at: data.created_at,
    };
  }

  // SQLite : on récupère via le userRepository
  const { findUserByEmail, toPublic } = await import('@/lib/userRepository');
  // Pas de findUserById dans le repository, on utilise une requête directe
  // ou on adapte — pour l'instant, la lecture se fait via getCurrentUser()
  // qui utilise le session token (email).
  void findUserByEmail;
  void toPublic;
  return null;
}

/**
 * Met à jour le mot de passe d'un utilisateur.
 */
export async function updateAuthPassword(
  userId: string,
  passwordHash: string,
): Promise<void> {
  const { updateUserPassword } = await import('@/lib/userRepository');
  await updateUserPassword(userId, passwordHash);
}

/**
 * Crée un jeton de réinitialisation de mot de passe.
 */
export async function createAuthResetToken(userId: string): Promise<string> {
  const { createResetToken } = await import('@/lib/userRepository');
  return createResetToken(userId);
}

/**
 * Valide un jeton de réinitialisation et retourne l'utilisateur associé.
 */
export async function validateAuthResetToken(
  token: string,
): Promise<AuthUser | null> {
  const { findUserByResetToken, toPublic } = await import('@/lib/userRepository');
  const user = await findUserByResetToken(token);
  if (!user) return null;
  const publicUser = toPublic(user);
  return {
    id: publicUser.id,
    email: publicUser.email,
    name: publicUser.name,
    role: publicUser.role as AuthRole,
    needs_password_reset: publicUser.needs_password_reset,
    email_verified: publicUser.email_verified,
    created_at: publicUser.created_at,
  };
}

/**
 * Supprime tous les jetons de réinitialisation d'un utilisateur.
 */
export async function deleteAuthResetTokens(userId: string): Promise<void> {
  const { deleteUserResetTokens } = await import('@/lib/userRepository');
  await deleteUserResetTokens(userId);
}

/**
 * Crée un jeton de vérification d'email.
 */
export async function createAuthVerificationToken(userId: string): Promise<string> {
  const { createEmailVerificationToken } = await import('@/lib/userRepository');
  return createEmailVerificationToken(userId);
}

/**
 * Valide un jeton de vérification d'email.
 */
export async function validateAuthVerificationToken(
  token: string,
): Promise<AuthUser | null> {
  const { findUserByEmailVerificationToken, toPublic } = await import('@/lib/userRepository');
  const user = await findUserByEmailVerificationToken(token);
  if (!user) return null;
  const publicUser = toPublic(user);
  return {
    id: publicUser.id,
    email: publicUser.email,
    name: publicUser.name,
    role: publicUser.role as AuthRole,
    needs_password_reset: publicUser.needs_password_reset,
    email_verified: publicUser.email_verified,
    created_at: publicUser.created_at,
  };
}

/**
 * Marque l'email d'un utilisateur comme vérifié.
 */
export async function markAuthEmailVerified(userId: string): Promise<void> {
  const { markEmailVerified } = await import('@/lib/userRepository');
  await markEmailVerified(userId);
}

/**
 * Crée ou lie un utilisateur Google.
 */
export async function upsertAuthGoogleUser(input: {
  googleSub: string;
  email: string;
  name: string;
  role: AuthRole;
  emailVerified: boolean;
}): Promise<AuthUser | null> {
  const { upsertGoogleUser } = await import('@/lib/userRepository');
  const user = await upsertGoogleUser({
    googleSub: input.googleSub,
    email: input.email,
    name: input.name,
    role: input.role as 'candidate' | 'company',
    emailVerified: input.emailVerified,
  });
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as AuthRole,
    needs_password_reset: user.needs_password_reset,
    email_verified: user.email_verified,
    created_at: user.created_at,
  };
}

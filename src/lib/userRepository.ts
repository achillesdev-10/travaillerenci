import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { hashPassword } from '@/lib/password';

/**
 *  TravaillerEnCi — src/lib/userRepository.ts
 *  Utilisateurs & jetons de réinitialisation de mot de passe.
 *
 *  • Local   : SQLite (fichier ./data/travaillerenci.sqlite3, tables `users`
 *    et `password_reset_tokens`) — schéma auto-créé à l'ouverture.
 *  • Prod    : Supabase (migration 0011_auth_users.sql), client service_role
 *    qui contourne la RLS pour les écritures.
 *
 *  Les mots de passe sont TOUJOURS stockés hachés (scrypt, voir password.ts).
 *  Les jetons de réinitialisation sont stockés sous forme de hash SHA-256 et
 *  expirent au bout d'1 heure.
 */

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  role: 'candidate' | 'company' | 'admin';
  password_hash: string;
  google_sub?: string | null;
  needs_password_reset: boolean;
  /** Vrai si l'email a été confirmé (lien de vérification cliqué, ou email
   *  vérifié par Google au moment du SSO). */
  email_verified: boolean;
  created_at: string;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: StoredUser['role'];
  /** Vrai si le compte n'a pas encore de mot de passe défini par l'utilisateur
   *  (comptes migrés depuis localStorage ou créés via Google). */
  needs_password_reset: boolean;
  /** Vrai si l'email a été confirmé. */
  email_verified: boolean;
  created_at: string;
};

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 heure
const EMAIL_VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toPublic(user: StoredUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    needs_password_reset: Boolean(user.needs_password_reset),
    email_verified: Boolean(user.email_verified),
    created_at: user.created_at,
  };
}

// -----------------------------------------------------------------------------
// SQLite (local)
// -----------------------------------------------------------------------------
type DatabaseSyncInstance = {
  prepare(sql: string): StatementInstance;
  exec(sql: string): void;
  close(): void;
};
type StatementInstance = {
  run(params?: unknown): { changes: number; lastInsertRowid: unknown };
  get(params?: unknown): any | undefined;
  all(params?: unknown): any[];
};

let cachedDb: DatabaseSyncInstance | null = null;

async function getDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb) return cachedDb;
  try {
    const mod = await import('node:sqlite');
    const { DatabaseSync } = mod as unknown as {
      DatabaseSync: new (path: string) => DatabaseSyncInstance;
    };
    const { resolve: resolvePath } = (await import('node:path')) as typeof import('node:path');
    const { existsSync: exists, mkdirSync: mkdir } = (await import('node:fs')) as typeof import('node:fs');
    const dataDir = resolvePath(process.cwd(), 'data');
    if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    cachedDb = new DatabaseSync(resolvePath(dataDir, 'travaillerenci.sqlite3'));
    ensureSchema(cachedDb);
    return cachedDb;
  } catch {
    return null;
  }
}

function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'candidate' CHECK (role IN ('candidate','company','admin')),
      password_hash TEXT NOT NULL,
      google_sub    TEXT UNIQUE,
      needs_password_reset INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS verify_email_tokens (
      token_hash TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migrations défensives pour les bases créées avant l'OAuth Google / la
  // migration des comptes. NB : SQLite interdit ADD COLUMN avec UNIQUE — on
  // ajoute la colonne nue puis on crée l'index UNIQUE (autorise les NULL).
  const cols = db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'google_sub')) {
    db.exec('ALTER TABLE users ADD COLUMN google_sub TEXT');
  }
  if (!cols.some((c) => c.name === 'needs_password_reset')) {
    db.exec('ALTER TABLE users ADD COLUMN needs_password_reset INTEGER NOT NULL DEFAULT 0');
  }
  if (!cols.some((c) => c.name === 'email_verified')) {
    db.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0');
  }

  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_sub ON users (google_sub);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens (user_id);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_verify_email_tokens_user ON verify_email_tokens (user_id);`);
}

// -----------------------------------------------------------------------------
// API publique
// -----------------------------------------------------------------------------

/** Crée un compte utilisateur. Retourne l'utilisateur public, ou null si l'email existe déjà. */
export async function createUser(input: {
  email: string;
  name: string;
  role: StoredUser['role'];
  passwordHash: string;
  googleSub?: string;
  needsPasswordReset?: boolean;
  /** Email déjà vérifié (ex. vérifié par Google lors du SSO). */
  emailVerified?: boolean;
}): Promise<PublicUser | null> {
  const email = input.email.trim().toLowerCase();
  const needsPasswordReset = Boolean(input.needsPasswordReset);
  const emailVerified = Boolean(input.emailVerified);

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('users')
      .insert({
        email,
        name: input.name.trim(),
        role: input.role,
        password_hash: input.passwordHash,
        google_sub: input.googleSub ?? null,
        needs_password_reset: needsPasswordReset,
        email_verified: emailVerified,
      })
      .select('id,email,name,role,needs_password_reset,email_verified,created_at')
      .maybeSingle();
    if (error) {
      // Violation d'unicité (23505) → l'email existe déjà.
      if (String(error.code) === '23505') return null;
      throw new Error(error.message);
    }
    return data as PublicUser;
  }

  const db = await getDb();
  if (!db) throw new Error('Base de données utilisateurs indisponible.');
  const existing = db
    .prepare('SELECT id FROM users WHERE email = $email')
    .get({ $email: email }) as { id: string } | undefined;
  if (existing) return null;

  const now = new Date().toISOString();
  const id = globalThis.crypto?.randomUUID?.() || `user-${Date.now().toString(36)}`;
  try {
    db.prepare(
      `INSERT INTO users (id, email, name, role, password_hash, google_sub, needs_password_reset, email_verified, created_at, updated_at)
       VALUES ($id, $email, $name, $role, $hash, $googleSub, $needsReset, $emailVerified, $now, $now)`,
    ).run({
      $id: id,
      $email: email,
      $name: input.name.trim(),
      $role: input.role,
      $hash: input.passwordHash,
      $googleSub: input.googleSub ?? null,
      $needsReset: needsPasswordReset ? 1 : 0,
      $emailVerified: emailVerified ? 1 : 0,
      $now: now,
    });
  } catch (err) {
    // Course possible entre la vérification et l'insertion : la contrainte
    // UNIQUE(email) prend le relais → même comportement que le chemin Supabase.
    const message = err instanceof Error ? err.message : '';
    if (/UNIQUE/i.test(message)) return null;
    throw err;
  }
  return {
    id,
    email,
    name: input.name.trim(),
    role: input.role,
    needs_password_reset: needsPasswordReset,
    email_verified: emailVerified,
    created_at: now,
  };
}

/**
 * Compte migré depuis l'ancien localStorage simulé (aucun mot de passe réel).
 * — email déjà présent → retourne null (le compte réel existant gagne, on ne
 *   l'écrase jamais) ;
 * — sinon crée le compte avec un mot de passe aléatoire INUTILISABLE et le
 *   drapeau needs_password_reset=1 : l'utilisateur devra définir son mot de
 *   passe (ou passer par Google, ou « mot de passe oublié »).
 */
export async function createMigratedUser(input: {
  email: string;
  name: string;
  role: 'candidate' | 'company';
}): Promise<PublicUser | null> {
  const email = input.email.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) return null;

  // Mot de passe aléatoire que personne ne connaît (le compte n'est utilisable
  // qu'après définition d'un vrai mot de passe, liaison Google ou reset).
  const unusablePassword = `migrated-${randomBytes(24).toString('hex')}`;
  return createUser({
    email,
    name: input.name.trim() || email.split('@')[0],
    role: input.role,
    passwordHash: hashPassword(unusablePassword),
    needsPasswordReset: true,
  });
}

/** Cherche un utilisateur par son identifiant Google (sub). */
export async function findUserByGoogleSub(googleSub: string): Promise<StoredUser | null> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('google_sub', googleSub)
      .maybeSingle();
    return (data as StoredUser) ?? null;
  }

  const db = await getDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM users WHERE google_sub = $sub').get({ $sub: googleSub });
  if (!row) return null;
  return {
    ...(row as StoredUser),
    needs_password_reset: Boolean(row.needs_password_reset),
    email_verified: Boolean(row.email_verified),
  };
}

/**
 * Crée ou lie un compte Google :
 *  — si le sub Google existe déjà → retourne l'utilisateur existant ;
 *  — sinon si un compte avec cet email existe ET que l'email Google est vérifié
 *    → lie le sub Google dessus ;
 *  — sinon crée un nouveau compte (mot de passe aléatoire, connexion via Google).
 *
 * Lier par email exige `email_verified` de Google : on évite qu'un compte
 * Google à l'email non vérifié s'empare d'un compte local existant.
 */
export async function upsertGoogleUser(input: {
  googleSub: string;
  email: string;
  name: string;
  role: 'candidate' | 'company';
  emailVerified: boolean;
}): Promise<PublicUser | null> {
  const email = input.email.trim().toLowerCase();

  // 1. Compte déjà lié à ce sub Google.
  const bySub = await findUserByGoogleSub(input.googleSub);
  if (bySub) return toPublic(bySub);

  // 2. Compte local avec le même email → on lie le sub Google (email vérifié).
  if (input.emailVerified) {
    const byEmail = await findUserByEmail(email);
    if (byEmail) {
      await linkGoogleSub(byEmail.id, input.googleSub);
      // L'email a été confirmé par Google : on marque le compte vérifié.
      if (!byEmail.email_verified) {
        await markEmailVerified(byEmail.id);
      }
      return toPublic(byEmail);
    }
  }

  // 3. Nouveau compte : mot de passe aléatoire impossible à connaître (le
  //    mot de passe oublié permet de réinitialiser si besoin) + drapeau
  //    needs_password_reset → l'utilisateur pourra définir un mot de passe.
  const randomPassword = `google-${randomBytes(24).toString('hex')}`;

  const created = await createUser({
    email,
    name: input.name.trim() || email.split('@')[0],
    role: input.role,
    passwordHash: hashPassword(randomPassword),
    googleSub: input.googleSub,
    needsPasswordReset: true,
    // L'email est confirmé par Google → pas de vérification d'email à refaire.
    emailVerified: input.emailVerified,
  });
  return created;
}

/** Lie un sub Google à un compte existant. */
export async function linkGoogleSub(userId: string, googleSub: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase
      .from('users')
      .update({ google_sub: googleSub, updated_at: new Date().toISOString() })
      .eq('id', userId);
    return;
  }
  const db = await getDb();
  if (!db) return;
  db.prepare('UPDATE users SET google_sub = $sub, updated_at = $now WHERE id = $id').run({
    $sub: googleSub,
    $now: new Date().toISOString(),
    $id: userId,
  });
}

/** Cherche un utilisateur par email (avec hash, pour vérifier le mot de passe). */
export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const normalized = email.trim().toLowerCase();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalized)
      .maybeSingle();
    return (data as StoredUser) ?? null;
  }

  const db = await getDb();
  if (!db) return null;
  const row = db.prepare('SELECT * FROM users WHERE email = $email').get({ $email: normalized });
  if (!row) return null;
  // SQLite stocke les drapeaux en 0/1 → on normalise en booléens.
  return {
    ...(row as StoredUser),
    needs_password_reset: Boolean(row.needs_password_reset),
    email_verified: Boolean(row.email_verified),
  };
}

/** Met à jour le mot de passe haché d'un utilisateur (lève needs_password_reset). */
export async function updateUserPassword(userId: string, passwordHash: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        needs_password_reset: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);
    return;
  }
  const db = await getDb();
  if (!db) return;
  db.prepare(
    'UPDATE users SET password_hash = $hash, needs_password_reset = 0, updated_at = $now WHERE id = $id',
  ).run({
    $hash: passwordHash,
    $now: new Date().toISOString(),
    $id: userId,
  });
}

/**
 * Crée un jeton de réinitialisation (retourne le jeton EN CLAIR — à envoyer
 * par email — seul son hash SHA-256 est stocké).
 */
export async function createResetToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré.');
    await supabase
      .from('password_reset_tokens')
      .insert({ token_hash: hashToken(token), user_id: userId, expires_at: expiresAt });
    return token;
  }

  const db = await getDb();
  if (!db) throw new Error('Base de données utilisateurs indisponible.');
  db.prepare(
    `INSERT INTO password_reset_tokens (token_hash, user_id, expires_at)
     VALUES ($hash, $userId, $expiresAt)`,
  ).run({ $hash: hashToken(token), $userId: userId, $expiresAt: expiresAt });
  return token;
}

/** Retourne l'utilisateur associé à un jeton valide (non expiré), sinon null. */
export async function findUserByResetToken(token: string): Promise<StoredUser | null> {
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    // Purge opportuniste des jetons expirés (évite l'accumulation).
    try {
      await supabase.from('password_reset_tokens').delete().lt('expires_at', now);
    } catch {
      // purge non bloquante
    }
    const { data } = await supabase
      .from('password_reset_tokens')
      .select('user_id,expires_at')
      .eq('token_hash', tokenHash)
      .gt('expires_at', now)
      .maybeSingle();
    if (!data) return null;
    const { data: user } = await supabase.from('users').select('*').eq('id', data.user_id).maybeSingle();
    return (user as StoredUser) ?? null;
  }

  const db = await getDb();
  if (!db) return null;
  // Purge opportuniste des jetons expirés (évite l'accumulation).
  db.prepare('DELETE FROM password_reset_tokens WHERE expires_at < $now').run({ $now: now });
  const row = db
    .prepare(
      `SELECT u.* FROM password_reset_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $hash AND t.expires_at > $now`,
    )
    .get({ $hash: tokenHash, $now: now });
  if (!row) return null;
  return { ...(row as StoredUser), needs_password_reset: Boolean(row.needs_password_reset) };
}

/** Supprime tous les jetons d'un utilisateur (après réinitialisation réussie). */
export async function deleteUserResetTokens(userId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.from('password_reset_tokens').delete().eq('user_id', userId);
    return;
  }
  const db = await getDb();
  if (!db) return;
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = $userId').run({ $userId: userId });
}

// -----------------------------------------------------------------------------
// Vérification d'email (jettons à usage unique, validité 24 h)
// -----------------------------------------------------------------------------

/**
 * Crée un jeton de vérification d'email (retourne le jeton EN CLAIR — à
 * envoyer par email — seul son hash SHA-256 est stocké).
 */
export async function createEmailVerificationToken(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + EMAIL_VERIFY_TOKEN_TTL_MS).toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase non configuré.');
    await supabase
      .from('verify_email_tokens')
      .insert({ token_hash: hashToken(token), user_id: userId, expires_at: expiresAt });
    return token;
  }

  const db = await getDb();
  if (!db) throw new Error('Base de données utilisateurs indisponible.');
  db.prepare(
    `INSERT INTO verify_email_tokens (token_hash, user_id, expires_at)
     VALUES ($hash, $userId, $expiresAt)`,
  ).run({ $hash: hashToken(token), $userId: userId, $expiresAt: expiresAt });
  return token;
}

/** Retourne l'utilisateur associé à un jeton de vérification valide, sinon null. */
export async function findUserByEmailVerificationToken(
  token: string,
): Promise<StoredUser | null> {
  const tokenHash = hashToken(token);
  const now = new Date().toISOString();

  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    // Purge opportuniste des jetons expirés.
    try {
      await supabase.from('verify_email_tokens').delete().lt('expires_at', now);
    } catch {
      // purge non bloquante
    }
    const { data } = await supabase
      .from('verify_email_tokens')
      .select('user_id')
      .eq('token_hash', tokenHash)
      .gt('expires_at', now)
      .maybeSingle();
    if (!data) return null;
    const { data: user } = await supabase.from('users').select('*').eq('id', data.user_id).maybeSingle();
    return (user as StoredUser) ?? null;
  }

  const db = await getDb();
  if (!db) return null;
  db.prepare('DELETE FROM verify_email_tokens WHERE expires_at < $now').run({ $now: now });
  const row = db
    .prepare(
      `SELECT u.* FROM verify_email_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = $hash AND t.expires_at > $now`,
    )
    .get({ $hash: tokenHash, $now: now });
  if (!row) return null;
  return {
    ...(row as StoredUser),
    needs_password_reset: Boolean(row.needs_password_reset),
    email_verified: Boolean(row.email_verified),
  };
}

/** Supprime tous les jetons de vérification d'email d'un utilisateur (après
 * échec d'envoi, pour ne pas laisser de lien mort — même convention que
 * deleteUserResetTokens). */
export async function deleteUserVerifyTokens(userId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase.from('verify_email_tokens').delete().eq('user_id', userId);
    return;
  }
  const db = await getDb();
  if (!db) return;
  db.prepare('DELETE FROM verify_email_tokens WHERE user_id = $userId').run({ $userId: userId });
}

/** Marque l'email d'un utilisateur comme vérifié + purge ses jetons. */
export async function markEmailVerified(userId: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    await supabase
      .from('users')
      .update({ email_verified: true, updated_at: new Date().toISOString() })
      .eq('id', userId);
    await supabase.from('verify_email_tokens').delete().eq('user_id', userId);
    return;
  }
  const db = await getDb();
  if (!db) return;
  db.prepare(
    'UPDATE users SET email_verified = 1, updated_at = $now WHERE id = $id',
  ).run({ $now: new Date().toISOString(), $id: userId });
  db.prepare('DELETE FROM verify_email_tokens WHERE user_id = $userId').run({ $userId: userId });
}

export { toPublic };

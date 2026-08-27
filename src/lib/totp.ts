/**
 *  TravaillerEnCi — src/lib/totp.ts
 *
 *  Gestion TOTP (Time-based One-Time Password) pour la 2FA admin.
 *  Compatible Google Authenticator, Authy, etc.
 *
 *  Le secret est stocké dans la variable d'environnement ADMIN_TOTP_SECRET.
 *  Pour un admin unique, c'est la solution la plus simple (pas de BDD).
 *  Pour régénérer : exécuter `npx tsx -e "import speakeasy from 'speakeasy'; console.log(speakeasy.generateSecret({ name: 'TravaillerEnCi Admin' }).base32)"`.
 */
import speakeasy from 'speakeasy';

const ISSUER = 'TravaillerEnCi Admin';

/**
 * Génère un nouveau secret TOTP (160 bits, base32).
 * Utile pour la configuration initiale uniquement.
 */
export function generateSecret(): string {
  const secret = speakeasy.generateSecret({
    name: ISSUER,
    length: 20,
  });
  return secret.base32;
}

/**
 * Crée l'URL otpauth:// pour le QR code.
 * L'utilisateur scanne ce QR code avec Google Authenticator / Authy.
 */
export function buildOtpauthUrl(secret: string, email: string): string {
  return speakeasy.otpauthURL({
    issuer: ISSUER,
    label: email,
    secret,
    encoding: 'base32',
  });
}

/**
 * Vérifie un code TOTP saisi par l'utilisateur.
 * Accepte une fenêtre de ±1 intervalle (30 s) pour compenser
 * les décalages d'horloge.
 */
export function verifyTotp(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1,
  });
}

/**
 * Retourne le secret TOTP configuré pour l'admin.
 * Retourne null si la 2FA n'est pas configurée.
 */
export function getAdminTotpSecret(): string | null {
  return process.env.ADMIN_TOTP_SECRET || null;
}

/**
 * Vérifie si la 2FA est activée pour l'admin.
 */
export function is2faEnabled(): boolean {
  return Boolean(getAdminTotpSecret());
}

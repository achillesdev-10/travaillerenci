/**
 *  POST /api/admin/session/verify-totp
 *
 *  Deuxième étape du flux de connexion admin avec 2FA.
 *  Reçoit le code TOTP saisi par l'utilisateur, vérifie qu'il est valide,
 *  puis crée la session admin (cookie httpOnly).
 *
 *  La session préliminaire (email) est transmise via un cookie signé éphémère
 *  défini lors de la première étape (/api/admin/session).
 */
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
} from '@/lib/adminSession';
import { getAdminTotpSecret, verifyTotp } from '@/lib/totp';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { notifyAdminLoginFailed } from '@/services/adminAlerts';

export const runtime = 'nodejs';

// Rate-limit plus strict sur la vérification TOTP : 5 tentatives / 5 min.
const TOTP_MAX_ATTEMPTS = 5;
const TOTP_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // --- Rate limiting TOTP ---
    if (
      isRateLimited(`admin-totp:${ip}`, TOTP_MAX_ATTEMPTS, TOTP_WINDOW_MS)
    ) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        { status: 429 },
      );
    }

    const totpSecret = getAdminTotpSecret();
    if (!totpSecret) {
      return NextResponse.json(
        { error: 'La 2FA n\'est pas configurée.' },
        { status: 400 },
      );
    }

    const body = (await request.json()) as {
      code?: string;
      email?: string;
    };

    const code = body.code?.trim() || '';
    const email = body.email?.trim().toLowerCase() || '';

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Code à 6 chiffres requis.' },
        { status: 400 },
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: 'Email manquant. Recommencez la connexion.' },
        { status: 400 },
      );
    }

    // --- Vérification TOTP ---
    const isValid = verifyTotp(totpSecret, code);
    if (!isValid) {
      // Alerte sur échec TOTP
      await notifyAdminLoginFailed({ ip, email: `${email} [TOTP échoué]` });

      return NextResponse.json(
        { error: 'Code de vérification invalide.' },
        { status: 401 },
      );
    }

    // --- Création de la session admin ---
    const token = await createAdminSessionToken(email);
    const response = NextResponse.json({
      ok: true,
      user: { email, role: 'admin' as const },
    });

    response.cookies.set({
      name: ADMIN_SESSION_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * Number(process.env.ADMIN_SESSION_TTL_HOURS || 12),
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: 'Impossible de vérifier le code.' },
      { status: 500 },
    );
  }
}

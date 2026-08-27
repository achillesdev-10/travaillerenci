import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  isAdminCredentialsConfigured,
  validateAdminCredentials,
} from '@/lib/adminSession';
import { is2faEnabled } from '@/lib/totp';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { notifyAdminLoginFailed } from '@/services/adminAlerts';

export const runtime = 'nodejs';

// --- Configuration rate-limit admin ------------------------------------------------
// Plus strict que le login candidat : 5 tentatives / 15 min par IP.
const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    // --- Rate limiting (5 tentatives / 15 min par IP) ---
    if (
      isRateLimited(
        `admin-login:${ip}`,
        ADMIN_LOGIN_MAX_ATTEMPTS,
        ADMIN_LOGIN_WINDOW_MS,
      )
    ) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessayez plus tard.' },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    const email = body.email?.trim().toLowerCase() || '';
    const password = body.password?.trim() || '';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Veuillez renseigner votre email et votre mot de passe.' },
        { status: 400 }
      );
    }

    if (!isAdminCredentialsConfigured() && process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Les identifiants admin ne sont pas configurés sur le serveur.' },
        { status: 503 }
      );
    }

    const isValid = await validateAdminCredentials(email, password);
    if (!isValid) {
      // --- Alerte WhatsApp sur échec de connexion ---
      await notifyAdminLoginFailed({ ip, email });

      return NextResponse.json(
        { error: 'Identifiants administrateur invalides.' },
        { status: 401 }
      );
    }

    // --- 2FA : si activé, retourner 2fa_required sans créer la session ---
    if (is2faEnabled()) {
      return NextResponse.json({
        status: '2fa_required',
        email,
      });
    }

    // --- Pas de 2FA : création directe de la session ---
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
      { error: 'Impossible de démarrer la session administrateur.' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: ADMIN_SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}

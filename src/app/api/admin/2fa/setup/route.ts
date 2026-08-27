/**
 *  POST /api/admin/2fa/setup
 *
 *  Utilisé pendant la configuration initiale de la 2FA admin.
 *  Vérifie que le code TOTP saisi correspond au secret généré.
 *  La configuration effective (sauvegarde du secret dans les variables d'env)
 *  est réalisée manuellement par l'admin.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { verifyTotp } from '@/lib/totp';
import { requireAdminApi } from '@/lib/adminSession';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // Protégé par session admin
    const auth = await requireAdminApi(request);
    if (auth.error) return auth.error;

    const body = (await request.json()) as {
      secret?: string;
      code?: string;
    };

    const secret = body.secret?.trim() || '';
    const code = body.code?.trim() || '';

    if (!secret || secret.length < 16) {
      return NextResponse.json(
        { error: 'Secret TOTP invalide.' },
        { status: 400 },
      );
    }

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Code à 6 chiffres requis.' },
        { status: 400 },
      );
    }

    // Vérifier que le code correspond au secret
    const isValid = verifyTotp(secret, code);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Code invalide. Assurez-vous que l\'heure de votre appareil est correcte.' },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Code vérifié. Ajoutez ADMIN_TOTP_SECRET dans vos variables d\'environnement.',
      secret,
    });
  } catch {
    return NextResponse.json(
      { error: 'Erreur lors de la vérification.' },
      { status: 500 },
    );
  }
}

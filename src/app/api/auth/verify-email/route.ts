import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  findUserByEmailVerificationToken,
  markEmailVerified,
} from '@/lib/userRepository';
import { getSiteUrl } from '@/lib/email';

export const runtime = 'nodejs';

/** Page HTML de confirmation (statut + lien retour). */
function confirmationPage({ ok, message, ctaHref, ctaLabel }: {
  ok: boolean;
  message: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Vérification d'email — TravaillerEnCi</title>
<style>
  body{margin:0;padding:32px 16px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;}
  .card{max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08);}
  .icon{width:56px;height:56px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:26px;${ok ? 'background:#e6f7ee;' : 'background:#fdecec;'}}
  h1{margin:0 0 8px;font-size:18px;color:#111827;}
  p{margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;}
  a{display:inline-block;background:#009639;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:12px;}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? '✅' : '⚠️'}</div>
    <h1>${ok ? 'Email confirmé' : 'Lien invalide ou expiré'}</h1>
    <p>${message}</p>
    <a href="${ctaHref}">${ctaLabel}</a>
  </div>
</body>
</html>`;
}

/**
 * GET /api/auth/verify-email?token=... — confirme l'email (cliqué depuis le
 * lien reçu par mail) puis affiche une page de confirmation.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';

  if (!token) {
    return new NextResponse(
      confirmationPage({
        ok: false,
        message: 'Aucun lien de vérification fourni.',
        ctaHref: `${getSiteUrl()}/login`,
        ctaLabel: 'Aller à la connexion',
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const user = await findUserByEmailVerificationToken(token);

  if (!user) {
    return new NextResponse(
      confirmationPage({
        ok: false,
        message:
          'Ce lien de vérification est invalide ou a expiré. Connectez-vous puis utilisez « Renvoyer le lien » depuis votre tableau de bord.',
        ctaHref: `${getSiteUrl()}/login`,
        ctaLabel: 'Aller à la connexion',
      }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  await markEmailVerified(user.id);

  return new NextResponse(
    confirmationPage({
      ok: true,
      message: `Merci ${user.name.split(' ')[0]} ! Votre adresse ${user.email} est désormais confirmée.`,
      ctaHref: `${getSiteUrl()}/dashboard/candidate`,
      ctaLabel: 'Accéder à mon espace',
    }),
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}


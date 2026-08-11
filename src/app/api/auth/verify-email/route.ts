import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  createEmailVerificationToken,
  findUserByEmail,
  findUserByEmailVerificationToken,
  markEmailVerified,
} from '@/lib/userRepository';
import {
  getEmailConfigStatus,
  getSiteUrl,
  isEmailConfigured,
  sendVerificationEmail,
} from '@/lib/email';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

/**
 * POST /api/auth/verify-email { email } — renvoie un lien de vérification.
 * (Utilisé par le bandeau « email non vérifié » du dashboard.)
 */
export async function POST(request: Request) {
  try {
    if (isRateLimited(`verify-email:${getClientIp(request)}`)) {
      return NextResponse.json(
        { error: 'Trop de demandes. Réessayez dans quelques minutes.' },
        { status: 429 },
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        { error: "L'envoi d'emails n'est pas configuré sur le site pour le moment." },
        { status: 503 },
      );
    }

    // Domaine de TEST Resend (@resend.dev) : l'envoi "réussit" mais n'est livré
    // qu'au propriétaire du compte Resend — le renvoi de lien échouerait
    // silencieusement pour les candidats. Journalisé bruyamment.
    const emailConfig = getEmailConfigStatus();
    if (emailConfig.usingTestDomain) {
      console.warn(
        `[auth] ⚠️ Renvoi de lien : EMAIL_FROM utilise le domaine de TEST Resend ` +
          `(${emailConfig.senderDomain}) — l'email n'est livré qu'au propriétaire du compte. ` +
          'Vérifier le domaine travaillerenci.ci dans Resend (docs/EMAIL_DELIVERY.md).',
      );
    }

    const body = (await request.json()) as { email?: string };
    const email = body.email?.trim().toLowerCase() || '';

    // Réponse volontairement neutre : on ne révèle pas si le compte existe.
    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ ok: true });
    }

    const user = await findUserByEmail(email);
    if (user && !user.email_verified) {
      const token = await createEmailVerificationToken(user.id);
      const verifyUrl = `${getSiteUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      try {
        await sendVerificationEmail(user.email, verifyUrl);
      } catch (err) {
        console.error('POST /api/auth/verify-email send error:', err);
        return NextResponse.json(
          { error: "Impossible d'envoyer l'email pour le moment. Réessayez plus tard." },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/auth/verify-email error:', err);
    return NextResponse.json(
      { error: 'Une erreur est survenue.' },
      { status: 500 },
    );
  }
}

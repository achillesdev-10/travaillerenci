import 'server-only';

/**
 *  TravaillerEnCi — src/lib/email.ts
 *  Envoi d'emails transactionnels via l'API REST Resend (aucun SDK requis).
 *
 *  Configuration :
 *    RESEND_API_KEY          — clé API (https://resend.com/api-keys)
 *    EMAIL_FROM              — expéditeur vérifié (défaut : TravaillerEnCi <noreply@travaillerenci.ci>)
 *    NEXT_PUBLIC_SITE_URL    — URL publique du site (défaut : https://travaillerenci.vercel.app)
 */

// URL publique du site — centralisée dans src/lib/site.ts (NEXT_PUBLIC_SITE_URL
// prioritaire, repli sur le domaine Vercel actuel tant que .ci est inactif).
import { getSiteUrl } from '@/lib/site';
export { getSiteUrl };

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** Domaine de test partagé Resend : il ne livre QUE vers l'adresse du compte
 * Resend (impossible d'envoyer aux candidats). Détecté pour ne jamais laisser
 * l'absence d'email de confirmation passer silencieusement. */
const RESEND_TEST_DOMAIN = 'resend.dev';

export type EmailConfigStatus = {
  configured: boolean;
  sender: string | null;
  senderDomain: string | null;
  /** Vrai si l'expéditeur utilise le domaine de test Resend (`@resend.dev`). */
  usingTestDomain: boolean;
  /** Message d'action clair pour l'utilisateur / les logs, null si tout va bien. */
  message: string | null;
};

/** État réel de l'expéditeur d'emails : clé présente + domaine d'expéditeur.
 * Permet de signaler avec précision la cause racine « aucun email reçu »
 * (clé absente OU domaine de test Resend qui ne livre qu'au propriétaire du
 * compte). */
export function getEmailConfigStatus(): EmailConfigStatus {
  const from = process.env.EMAIL_FROM || 'TravaillerEnCi <noreply@travaillerenci.ci>';
  const match = from.match(/<([^>]+)>/);
  const senderEmail = match ? match[1] : from;
  const senderDomain = senderEmail.includes('@')
    ? senderEmail.split('@')[1].toLowerCase()
    : null;
  const usingTestDomain = senderDomain === RESEND_TEST_DOMAIN;

  if (!process.env.RESEND_API_KEY) {
    return {
      configured: false,
      sender: null,
      senderDomain: null,
      usingTestDomain: false,
      message:
        "L'envoi d'emails n'est pas configuré : RESEND_API_KEY est absente de " +
        "l'environnement. À définir dans Vercel → Settings → Environment Variables.",
    };
  }
  if (usingTestDomain) {
    return {
      configured: true,
      sender: from,
      senderDomain,
      usingTestDomain: true,
      message:
        "L'email part du domaine de TEST Resend (onboarding@resend.dev) : il n'est " +
        'livré qu\'à l\'adresse du compte Resend, jamais aux candidats. Vérifiez le ' +
        'domaine travaillerenci.ci dans Resend (SPF/DKIM) puis mettez à jour EMAIL_FROM.',
    };
  }
  return {
    configured: true,
    sender: from,
    senderDomain,
    usingTestDomain: false,
    message: null,
  };
}

interface ResendPayload {
  from: string;
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY non configuré.');
  }
  const from = process.env.EMAIL_FROM || 'TravaillerEnCi <noreply@travaillerenci.ci>';
  const payload: ResendPayload = { from, to, subject, html };

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Resend a répondu ${response.status} : ${body.slice(0, 300)}`);
  }
  return response.json();
}

/** Email de réinitialisation de mot de passe (HTML français, couleurs du site). */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const siteUrl = getSiteUrl();
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
          <!-- En-tête -->
          <tr>
            <td style="background:linear-gradient(135deg,#009639,#007a2e);padding:28px 32px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:#f77f00;border-radius:10px;width:44px;height:44px;text-align:center;vertical-align:middle;">
                    <span style="color:#ffffff;font-size:22px;font-weight:900;">T</span>
                  </td>
                </tr>
              </table>
              <p style="margin:12px 0 0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">
                Travailler<span style="color:#ffffff;">En</span>Ci
              </p>
            </td>
          </tr>
          <!-- Corps -->
          <tr>
            <td style="padding:32px 32px 12px;">
              <h1 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:700;">
                Réinitialisation de votre mot de passe
              </h1>
              <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">
                Bonjour,<br />
                Nous avons reçu une demande de réinitialisation de mot de passe pour votre
                compte <strong>TravaillerEnCi</strong>. Cliquez sur le bouton ci-dessous pour
                choisir un nouveau mot de passe.
              </p>
              <p style="margin:0 0 20px;text-align:center;">
                <a href="${resetUrl}"
                   style="display:inline-block;background:#009639;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px;">
                  Réinitialiser mon mot de passe
                </a>
              </p>
              <p style="margin:0 0 8px;color:#4b5563;font-size:13px;line-height:1.6;">
                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
                <a href="${resetUrl}" style="color:#009639;word-break:break-all;font-size:12px;">${resetUrl}</a>
              </p>
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                Ce lien est valable <strong>1 heure</strong>. Si vous n'êtes pas à l'origine de
                cette demande, vous pouvez ignorer cet email — votre mot de passe restera inchangé.
              </p>
            </td>
          </tr>
          <!-- Pied de page -->
          <tr>
            <td style="padding:20px 32px 28px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} TravaillerEnCi — L'emploi en Côte d'Ivoire
              </p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:11px;">
                <a href="${siteUrl}" style="color:#6b7280;text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(to, 'Réinitialisation de votre mot de passe — TravaillerEnCi', html);
}

/** Email de confirmation d'adresse (HTML français, couleurs du site). */
export async function sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
  const siteUrl = getSiteUrl();
  const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#009639,#007a2e);padding:28px 32px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:0.3px;">
                Travailler<span style="color:#ffffff;">En</span>Ci
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 12px;">
              <h1 style="margin:0 0 12px;color:#111827;font-size:20px;font-weight:700;">
                Confirmez votre adresse email
              </h1>
              <p style="margin:0 0 16px;color:#4b5563;font-size:14px;line-height:1.6;">
                Bonjour,<br />
                Vous venez de créer un compte <strong>TravaillerEnCi</strong>.
                Confirmez votre adresse email pour activer toutes les fonctionnalités
                (alertes, sauvegarde d'offres…).
              </p>
              <p style="margin:0 0 20px;text-align:center;">
                <a href="${verifyUrl}"
                   style="display:inline-block;background:#009639;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:12px;">
                  Confirmer mon email
                </a>
              </p>
              <p style="margin:0 0 8px;color:#4b5563;font-size:13px;line-height:1.6;">
                Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br />
                <a href="${verifyUrl}" style="color:#009639;word-break:break-all;font-size:12px;">${verifyUrl}</a>
              </p>
              <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
                Ce lien est valable <strong>24 heures</strong>. Si vous n'êtes pas à
                l'origine de cette inscription, vous pouvez ignorer cet email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px;text-align:center;border-top:1px solid #f3f4f6;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                © ${new Date().getFullYear()} TravaillerEnCi — L'emploi en Côte d'Ivoire
              </p>
              <p style="margin:6px 0 0;color:#9ca3af;font-size:11px;">
                <a href="${siteUrl}" style="color:#6b7280;text-decoration:none;">${siteUrl.replace(/^https?:\/\//, '')}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  await sendEmail(to, 'Confirmez votre email — TravaillerEnCi', html);
}

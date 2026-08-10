import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AlertService } from '@/services/alertService';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';

/**
 * GET /api/alerts/unsubscribe?token=… — désactive l'alerte correspondant au
 * jeton (lié dans chaque email / message WhatsApp) puis affiche une
 * confirmation. Lien de désinscription obligatoire (anti-spam, RGPD).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const siteUrl = getSiteUrl();

  let ok = false;
  let label = '';

  if (token) {
    const alert = await AlertService.deactivateByUnsubscribeToken(token);
    if (alert) {
      ok = true;
      label = alert.label;
    }
  }

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Désinscription — TravaillerEnCi</title>
<style>
  body{margin:0;padding:32px 16px;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;}
  .card{max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 8px 30px rgba(0,0,0,.08);}
  .icon{width:56px;height:56px;border-radius:50%;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:26px;background:#e6f7ee;}
  h1{margin:0 0 8px;font-size:18px;color:#111827;}
  p{margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;}
  a{display:inline-block;background:#009639;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 24px;border-radius:12px;}
</style>
</head>
<body>
  <div class="card">
    <div class="icon">${ok ? '✅' : 'ℹ️'}</div>
    <h1>${ok ? 'Alerte désactivée' : 'Lien invalide'}</h1>
    <p>
      ${ok
        ? `Vous ne recevrez plus de notifications pour l'alerte « <strong>${label.replace(/</g, '&lt;')}</strong> ».<br />Vous pouvez en créer de nouvelles à tout moment depuis votre espace.`
        : 'Ce lien de désinscription est invalide ou a déjà été utilisé.'}
    </p>
    <a href="${siteUrl}">Retour au site</a>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

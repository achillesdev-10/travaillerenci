import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { NewsletterService } from '@/services/newsletterService';
import { recordEvent } from '@/services/analyticsService';
import { isRateLimited, getClientIp } from '@/lib/rateLimit';
import {
  NEWSLETTER_CONSENT_TEXT,
  extractUtmParams,
  isValidNewsletterEmail,
} from '@/lib/newsletter';

export const runtime = 'nodejs';

/**
 * POST /api/newsletter { email, source?, frequency?, consent?, page? }
 * Inscription à la newsletter — enregistrement seul (§20 : aucun envoi).
 * Le consentement explicite est obligatoire et sa mention est stockée.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (isRateLimited(`newsletter:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de tentatives. Réessayez plus tard.' }, { status: 429 });
  }

  const body = (await request.json().catch(() => null)) as {
    email?: string;
    source?: string;
    frequency?: string;
    consent?: unknown;
    page?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  } | null;

  if (!body || !isValidNewsletterEmail(body.email)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
  }
  if (body.consent !== true) {
    return NextResponse.json(
      { error: 'Merci d’accepter de recevoir la newsletter.' },
      { status: 400 },
    );
  }

  const utm = extractUtmParams(body.page) ?? extractUtmParams(body as Record<string, unknown>);
  const result = await NewsletterService.subscribe({
    email: body.email,
    source: body.source,
    frequency: body.frequency,
    consent_text: NEWSLETTER_CONSENT_TEXT,
    utm_source: utm?.utm_source ?? body.utm_source,
    utm_medium: utm?.utm_medium ?? body.utm_medium,
    utm_campaign: utm?.utm_campaign ?? body.utm_campaign,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // Mesure (§22) : libellé = source du formulaire, jamais l'adresse email.
  if (!result.already) {
    await recordEvent({
      event: 'newsletter_subscribe',
      label: result.subscriber.source,
      path: '/',
    });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

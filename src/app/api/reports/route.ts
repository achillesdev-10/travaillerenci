import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { ExamService } from '@/services/examService';
import {
  ReportService,
  REPORT_REASONS,
  type ReportReason,
} from '@/services/reportService';
import {
  SAVED_ITEM_TYPES,
  type SavedItemType,
} from '@/services/savedItemsService';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';

const MAX_DETAILS_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 200;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function isSavedItemType(value: string): value is SavedItemType {
  return (SAVED_ITEM_TYPES as string[]).includes(value);
}

function isReportReason(value: string): value is ReportReason {
  return (REPORT_REASONS as string[]).includes(value);
}

/**
 * POST /api/reports { item_type, item_id, reason, details?, reporter_email? }
 * Crée un signalement d'abus — anonyme autorisé (sans compte), le candidat
 * connecté est rattaché automatiquement pour faciliter le suivi.
 */
export async function POST(request: NextRequest) {
  // Anti-CSRF / anti-spam : un site tiers ne doit pas pouvoir poster un
  // signalement au nom d'un candidat connecté (cookie de session inclus).
  // On tolère l'absence d'en-tête Origin (curl, outils serveur).
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(getSiteUrl()).origin) {
        return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: 'Requête non autorisée.' }, { status: 403 });
    }
  }

  // Anti-spam : 5 signalements / 10 min par IP.
  const ip = getClientIp(request);
  if (isRateLimited(`report:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Trop de signalements envoyés. Réessayez dans quelques minutes.' },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const itemType = typeof body.item_type === 'string' ? body.item_type : '';
  const itemId = typeof body.item_id === 'string' ? body.item_id.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const details =
    typeof body.details === 'string' ? body.details.trim().slice(0, MAX_DETAILS_LENGTH) : '';
  const reporterEmail =
    typeof body.reporter_email === 'string' ? body.reporter_email.trim() : '';

  if (!isSavedItemType(itemType) || !itemId || itemId.length > 100) {
    return NextResponse.json(
      { error: 'Type ou identifiant de contenu invalide.' },
      { status: 400 },
    );
  }
  if (!isReportReason(reason)) {
    return NextResponse.json(
      { error: 'Merci de choisir un motif de signalement.' },
      { status: 400 },
    );
  }
  if (reporterEmail && (!EMAIL_RE.test(reporterEmail) || reporterEmail.length > MAX_EMAIL_LENGTH)) {
    return NextResponse.json({ error: 'Adresse email invalide.' }, { status: 400 });
  }

  // Vérifie que le contenu signalé existe encore (évite les ids bidons).
  const exists =
    itemType === 'exam'
      ? await ExamService.getById(itemId)
      : await JobOfferSchemaService.getById(itemId);
  if (!exists) {
    return NextResponse.json({ error: 'Contenu introuvable.' }, { status: 404 });
  }

  // Rattache le candidat connecté (optionnel) — email préféré : celui du
  // formulaire s'il est renseigné, sinon celui du compte.
  const user = await getCurrentUser();
  const created = await ReportService.create({
    reporter_user_id: user?.id ?? null,
    reporter_email: reporterEmail || user?.email || null,
    item_type: itemType,
    item_id: itemId,
    reason,
    details: details || null,
  });

  if (!created) {
    return NextResponse.json(
      { error: "Impossible d'enregistrer le signalement pour le moment." },
      { status: 500 },
    );
  }

  // Notification admin (fire-and-forget)
  try {
    const { AdminNotificationService } = await import('@/services/adminNotificationService');
    await AdminNotificationService.create(
      'new_report',
      `Nouveau signalement : ${itemType} signalé pour "${reason}"`,
      '/cz7tk/reports',
    );
  } catch {
    // Silently ignore — notification is non-critical
  }

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}

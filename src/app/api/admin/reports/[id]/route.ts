import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { ReportService, REPORT_STATUSES, type ReportStatus } from '@/services/reportService';

export const runtime = 'nodejs';

/**
 * PATCH /api/admin/reports/[id] { status }
 * Traite un signalement : 'resolved' (contenu modéré), 'dismissed' (classé
 * sans suite) ou 'pending' (rouverture de la file).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const status = typeof body.status === 'string' ? body.status : '';
  if (!(REPORT_STATUSES as string[]).includes(status)) {
    return NextResponse.json(
      { error: 'Statut invalide. Utilisez pending, resolved ou dismissed.' },
      { status: 400 },
    );
  }

  try {
    const updated = await ReportService.updateStatus(
      id,
      status as ReportStatus,
      auth.session.email,
    );
    if (!updated) {
      return NextResponse.json({ error: 'Signalement introuvable.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true, report: updated });
  } catch (err) {
    console.error('PATCH /api/admin/reports/[id] error:', err);
    return NextResponse.json(
      { error: 'Impossible de traiter ce signalement.' },
      { status: 500 },
    );
  }
}

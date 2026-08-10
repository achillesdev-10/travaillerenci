import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { ReportService, REPORT_STATUSES, type ReportStatus } from '@/services/reportService';
import { resolveContentItem } from '@/lib/itemResolver';

export const runtime = 'nodejs';

/**
 * GET /api/admin/reports?status=pending|resolved|dismissed|all
 * File de modération des signalements, enrichie avec les métadonnées du
 * contenu signalé (titre, lien…). Par défaut : signalements en attente.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const rawStatus = request.nextUrl.searchParams.get('status') || 'pending';
  const status =
    rawStatus === 'all' || (REPORT_STATUSES as string[]).includes(rawStatus)
      ? (rawStatus as ReportStatus | 'all')
      : 'pending';

  try {
    const [reports, counts] = await Promise.all([
      ReportService.list(status),
      ReportService.countByStatus(),
    ]);

    const items = await Promise.all(
      reports.map(async (report) => {
        const content = await resolveContentItem(report.item_type, report.item_id);
        return {
          ...report,
          content, // null si le contenu a été supprimé depuis
        };
      }),
    );

    return NextResponse.json({ reports: items, counts });
  } catch (err) {
    console.error('GET /api/admin/reports error:', err);
    return NextResponse.json(
      { error: 'Impossible de charger les signalements.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { RecommendationService } from '@/services/recommendationService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/recommendations?limit=6
 * Offres recommandées pour le candidat connecté (score déterministe).
 * 401 si non connecté — la route ne divulgue jamais de données sans session.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const limitParam = Number(request.nextUrl.searchParams.get('limit'));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 24) : 6;

  const result = await RecommendationService.getForUser(user.id, { limit });

  return NextResponse.json({
    total: result.total,
    isFallback: result.isFallback,
    profilePersonalized: result.profilePersonalized,
    jobs: result.jobs.map((r) => ({
      ...r.job,
      recommendation: { score: r.score, reasons: r.reasons },
    })),
  });
}

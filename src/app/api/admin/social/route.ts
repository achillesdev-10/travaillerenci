/**
 *  TravaillerEnCi — /api/admin/social
 *  Routes admin du module « Réseaux sociaux » :
 *   GET  → liste des tâches + stats + statut connexions + config (aucun secret)
 *   POST → { action: 'scan' } déclenche l'enfilement manuel des contenus publiés
 *
 *  Protégé par la session admin (requireAdminApi).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import type { SocialPlatform, SocialPostStatus } from '@/types/social';
import { SocialPostService } from '@/services/social/socialPostService';
import { enqueuePublishedContent, scheduleQueued } from '@/services/social/socialQueueService';
import { getConnectionsStatus } from '@/services/social/socialConnection';
import { getSocialConfigSummary } from '@/services/social/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_STATUSES: SocialPostStatus[] = [
  'queued', 'scheduled', 'publishing', 'published', 'failed', 'ignored', 'cancelled',
];
const ALLOWED_PLATFORMS: SocialPlatform[] = ['facebook', 'linkedin'];

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const rawStatus = searchParams.get('status');
  const rawPlatform = searchParams.get('platform');
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 100, 1), 500);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);

  const status = rawStatus
    ? rawStatus.split(',').filter((s): s is SocialPostStatus => ALLOWED_STATUSES.includes(s as SocialPostStatus))
    : undefined;
  const platform = ALLOWED_PLATFORMS.includes(rawPlatform as SocialPlatform)
    ? (rawPlatform as SocialPlatform)
    : undefined;

  const [listing, stats, connections, config] = await Promise.all([
    SocialPostService.list({ status, platform, limit, offset }),
    SocialPostService.countByStatus(),
    getConnectionsStatus(),
    Promise.resolve(getSocialConfigSummary()),
  ]);

  return NextResponse.json({
    posts: listing.rows,
    total: listing.total,
    stats,
    connections,
    config,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json().catch(() => null)) as { action?: unknown } | null;
    if (body?.action !== 'scan') {
      return NextResponse.json({ error: 'Action invalide.' }, { status: 400 });
    }
    const enqueued = await enqueuePublishedContent();
    const scheduled = await scheduleQueued();
    return NextResponse.json({ ok: true, enqueued, scheduled });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne.' },
      { status: 500 },
    );
  }
}

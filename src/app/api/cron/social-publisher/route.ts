/**
 *  TravaillerEnCi — /api/cron/social-publisher
 *  Worker de la file sociale, déclenchable par Vercel Cron (vercel.json).
 *
 *  Sécurité : toute requête sans `Authorization: Bearer <CRON_SECRET>` est
 *  refusée (401). Le secret est défini dans Vercel → Settings → Environment
 *  Variables et envoyé automatiquement par Vercel Cron.
 *
 *  Étapes :
 *   1. enqueuePublishedContent() — contenus publiés → social_posts (dédup)
 *   2. scheduleQueued()          — créneaux progressifs + limites quotidiennes
 *   3. processDue()              — publication (ou dry-run) + retries
 *
 *  Jamais de secret dans la réponse : uniquement des compteurs.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isCronAuthorized } from '@/lib/cronAuth';
import {
  enqueuePublishedContent,
  processDue,
  scheduleQueued,
} from '@/services/social/socialQueueService';
import { isSocialDryRun } from '@/services/social/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  try {
    const enqueued = await enqueuePublishedContent();
    const scheduled = await scheduleQueued();
    const processed = await processDue();

    return NextResponse.json({
      ok: true,
      dryRun: isSocialDryRun(),
      enqueued,
      scheduled,
      processed: processed.processed,
      published: processed.published,
      failed: processed.failed,
      skipped: processed.skipped,
      at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SocialPublisher] cron error:', error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erreur interne.',
      },
      { status: 500 },
    );
  }
}

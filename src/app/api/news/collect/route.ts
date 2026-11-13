/**
 *  TravaillerEnCi — /api/news/collect
 *  Déclencheur du pipeline RSS → dédoublonnage → rédaction IA.
 *
 *  Appelé par pg_cron (toutes les 3 h) via pg_net, ou manuellement par un
 *  administrateur. La publication reste différée de 15 min et contrôlée par
 *  `news_publish_due_articles()` (pg_cron, chaque minute).
 *
 *  Sécurité : Bearer `NEWS_PIPELINE_SECRET` (ou `CRON_SECRET` en repli).
 *  Fail-closed : si aucun secret n'est configuré, la route refuse tout appel.
 */

import { NextRequest, NextResponse } from 'next/server';
import { collectNews } from '@/lib/news/collector';
import { NewsRepository } from '@/lib/news/repository';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function readSecret(): string | null {
  return process.env.NEWS_PIPELINE_SECRET || process.env.CRON_SECRET || null;
}

function isAuthorized(request: NextRequest): boolean {
  const secret = readSecret();
  if (!secret) return false;
  const header = request.headers.get('authorization') || '';
  return header === `Bearer ${secret}`;
}

async function run(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!NewsRepository.isAvailable()) {
    return NextResponse.json(
      { error: 'Supabase non configuré (clé service role manquante).' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === '1' || searchParams.get('force') === 'true';
  const trigger = searchParams.get('trigger') || 'cron';

  const result = await collectNews({ force, trigger });
  const status = result.status === 'error' ? 500 : 200;
  return NextResponse.json(result, { status });
}

export async function GET(request: NextRequest) {
  return run(request);
}

export async function POST(request: NextRequest) {
  return run(request);
}

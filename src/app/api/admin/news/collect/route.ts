import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { collectNews } from '@/lib/news/collector';
import { NewsRepository } from '@/lib/news/repository';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** POST /api/admin/news/collect — déclenche une collecte manuelle (admin). */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  if (!NewsRepository.isAvailable()) {
    return NextResponse.json(
      { error: 'Supabase non configuré : collecte indisponible.' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') !== '0';
  const result = await collectNews({ force, trigger: `admin:${auth.session?.email || 'admin'}` });
  return NextResponse.json(result, { status: result.status === 'error' ? 500 : 200 });
}

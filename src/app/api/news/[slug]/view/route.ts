import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { NewsRepository } from '@/lib/news/repository';

export const dynamic = 'force-dynamic';

/** POST /api/news/[slug]/view — compteur de vues public, silencieux. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  if (!slug) return new NextResponse(null, { status: 204 });

  const ip = getClientIp(request);
  if (isRateLimited(`article-view:${ip}:${slug}`, 3, 60 * 60 * 1000)) {
    return new NextResponse(null, { status: 204 });
  }

  await NewsRepository.incrementView(slug).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}

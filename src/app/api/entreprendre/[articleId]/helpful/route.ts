import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { EntreprendreArticleService } from '@/services/entreprendreService';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';

/**
 * POST /api/entreprendre/[articleId]/helpful
 * Incrémente le compteur "Cet article vous a aidé ?" (un vote par IP / 24h).
 * Pas besoin d'authentification — le vote est best-effort.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const { articleId } = await params;

  if (!articleId || articleId.length > 100) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  }

  // --- Anti-CSRF ---
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

  // --- Rate limiting : 1 vote / 24h par IP ---
  const ip = getClientIp(request);
  if (isRateLimited(`helpful:${ip}`, 1, 24 * 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Vous avez déjà voté pour cet article.' },
      { status: 429 },
    );
  }

  // --- Vérifie que l'article existe et est publié ---
  const article = await EntreprendreArticleService.getById(articleId);
  if (!article || article.status !== 'published') {
    return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
  }

  // --- Incrémente ---
  await EntreprendreArticleService.incrementHelpfulCount(articleId);

  return NextResponse.json({ ok: true, helpful_count: article.helpful_count + 1 });
}

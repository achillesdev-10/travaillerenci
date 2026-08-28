import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { EntreprendreArticleService, EntreprendreCommentService } from '@/services/entreprendreService';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';

const MAX_CONTENT_LENGTH = 2000;

/**
 * GET /api/entreprendre/[articleId]/comments
 * Liste les commentaires VISIBLES d'un article (accès public).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const { articleId } = await params;

  if (!articleId || articleId.length > 100) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  }

  // Vérifie que l'article existe et est publié
  const article = await EntreprendreArticleService.getById(articleId);
  if (!article || article.status !== 'published') {
    return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
  }

  const { rows: comments, total } = await EntreprendreCommentService.list({
    article_id: articleId,
    status: 'visible',
    limit: 100,
    offset: 0,
  });

  return NextResponse.json({ comments, total });
}

/**
 * POST /api/entreprendre/[articleId]/comments
 * Ajoute un commentaire (utilisateurs authentifiés uniquement).
 * Body JSON : { content: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const { articleId } = await params;

  // --- Authentification requise ---
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Vous devez être connecté pour commenter.' },
      { status: 401 },
    );
  }

  // --- Vérifie que l'article existe et est publié ---
  if (!articleId || articleId.length > 100) {
    return NextResponse.json({ error: 'Identifiant invalide.' }, { status: 400 });
  }
  const article = await EntreprendreArticleService.getById(articleId);
  if (!article || article.status !== 'published') {
    return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
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

  // --- Rate limiting : 5 commentaires / 10 min par IP ---
  const ip = getClientIp(request);
  if (isRateLimited(`comment:${ip}`, 5, 10 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Trop de commentaires envoyés. Réessayez dans quelques minutes.' },
      { status: 429 },
    );
  }

  // --- Parse & valide le body ---
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const content = typeof body.content === 'string' ? body.content.trim() : '';
  if (!content) {
    return NextResponse.json({ error: 'Le commentaire ne peut pas être vide.' }, { status: 400 });
  }
  if (content.length > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { error: `Le commentaire ne peut pas dépasser ${MAX_CONTENT_LENGTH} caractères.` },
      { status: 400 },
    );
  }

  // --- Crée le commentaire ---
  const created = await EntreprendreCommentService.create({
    article_id: articleId,
    user_id: user.id,
    user_display_name: user.name || user.email?.split('@')[0] || 'Utilisateur',
    content,
    status: 'visible',
  });

  if (!created) {
    return NextResponse.json(
      { error: "Impossible d'enregistrer le commentaire." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, comment: created }, { status: 201 });
}

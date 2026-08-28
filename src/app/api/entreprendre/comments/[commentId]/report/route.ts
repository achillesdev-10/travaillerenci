import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { EntreprendreCommentService } from '@/services/entreprendreService';
import { getSiteUrl } from '@/lib/site';

export const runtime = 'nodejs';

/**
 * POST /api/entreprendre/comments/[commentId]/report
 * Signale un commentaire (passe en statut "reported").
 * Authentification requise pour éviter les abus.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const { commentId } = await params;

  // --- Authentification requise ---
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Vous devez être connecté pour signaler un commentaire.' },
      { status: 401 },
    );
  }

  if (!commentId || commentId.length > 100) {
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

  // --- Rate limiting : 10 signalements / 1h par IP ---
  const ip = getClientIp(request);
  if (isRateLimited(`report-comment:${ip}`, 10, 60 * 60 * 1000)) {
    return NextResponse.json(
      { error: 'Trop de signalements envoyés. Réessayez plus tard.' },
      { status: 429 },
    );
  }

  // --- Vérifie que le commentaire existe ---
  const comment = await EntreprendreCommentService.getById(commentId);
  if (!comment) {
    return NextResponse.json({ error: 'Commentaire introuvable.' }, { status: 404 });
  }

  // --- Ne pas signaler son propre commentaire ---
  if (comment.user_id === user.id) {
    return NextResponse.json(
      { error: 'Vous ne pouvez pas signaler votre propre commentaire.' },
      { status: 400 },
    );
  }

  // --- Passe en statut "reported" (seulement si pas déjà signalé) ---
  if (comment.status !== 'reported') {
    await EntreprendreCommentService.updateStatus(commentId, 'reported');
  }

  return NextResponse.json({ ok: true });
}

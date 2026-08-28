import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { EntreprendreCommentService } from '@/services/entreprendreService';
import type { EntreprendreCommentStatus } from '@/types/entreprendre';

const ALLOWED_STATUSES: EntreprendreCommentStatus[] = ['visible', 'hidden', 'reported'];

/**
 * PATCH /api/admin/entreprendre/comments/[id]
 * Modifie le statut d'un commentaire (visible / hidden / reported).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const status = typeof body.status === 'string' ? body.status : '';
  if (!ALLOWED_STATUSES.includes(status as EntreprendreCommentStatus)) {
    return NextResponse.json(
      { error: 'Statut invalide. Valeurs autorisées : visible, hidden, reported.' },
      { status: 400 },
    );
  }

  const updated = await EntreprendreCommentService.updateStatus(id, status as EntreprendreCommentStatus);
  if (!updated) {
    return NextResponse.json({ error: 'Commentaire introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, comment: updated });
}

/**
 * DELETE /api/admin/entreprendre/comments/[id]
 * Supprime un commentaire.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(_request);
  if (auth.error) return auth.error;

  const { id } = await params;

  const removed = await EntreprendreCommentService.remove(id);
  if (!removed) {
    return NextResponse.json({ error: 'Commentaire introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { EntreprendreCommentService } from '@/services/entreprendreService';
import type { EntreprendreCommentStatus } from '@/types/entreprendre';

const ALLOWED_STATUSES: EntreprendreCommentStatus[] = ['visible', 'hidden', 'reported'];

/**
 * GET /api/admin/entreprendre/comments
 * Liste les commentaires pour la modération (tous statuts).
 */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const articleId = searchParams.get('article_id') || undefined;

  try {
    const filters: Parameters<typeof EntreprendreCommentService.list>[0] = {
      limit: 200,
      offset: 0,
    };
    if (status && ALLOWED_STATUSES.includes(status as EntreprendreCommentStatus)) {
      filters.status = status as EntreprendreCommentStatus;
    }
    if (articleId) {
      filters.article_id = articleId;
    }

    const { rows, total } = await EntreprendreCommentService.list(filters);
    return NextResponse.json({ ok: true, comments: rows, total });
  } catch (err) {
    console.error('GET /api/admin/entreprendre/comments error:', err);
    return NextResponse.json({ error: 'Impossible de charger les commentaires.' }, { status: 500 });
  }
}

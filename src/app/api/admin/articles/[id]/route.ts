import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { ArticleService } from '@/services/articleService';
import type { ArticleInsert, ArticleStatus } from '@/types/article';

const ALLOWED_STATUSES: ArticleStatus[] = ['draft', 'published', 'archived'];

function revalidateArticlePages(slug?: string) {
  revalidatePath('/actualites');
  if (slug) revalidatePath(`/actualites/${slug}`);
}

/**
 * PATCH /api/admin/articles/[id] — changement de statut (modération).
 * Body : { status: 'draft' | 'published' | 'archived' }
 * À la publication, published_at est renseigné s'il était absent.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const status = body.status as ArticleStatus;

    if (!ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide (draft, published ou archived attendu).' },
        { status: 400 },
      );
    }

    const existing = await ArticleService.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
    }

    const patch: Partial<ArticleInsert> = { status };
    if (status === 'published' && !existing.published_at) {
      patch.published_at = new Date().toISOString();
    }

    const updated = await ArticleService.update(id, patch);
    if (!updated) {
      return NextResponse.json(
        { error: 'Impossible de modifier le statut.' },
        { status: 500 },
      );
    }

    revalidateArticlePages(updated.slug);
    return NextResponse.json({ ok: true, article: updated });
  } catch (err) {
    console.error('PATCH /api/admin/articles/[id] error:', err);
    return NextResponse.json(
      { error: 'Impossible de modifier cet article.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const existing = await ArticleService.getById(id);
    const removed = await ArticleService.remove(id);
    if (!removed) {
      return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
    }

    revalidateArticlePages(existing?.slug);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/articles/[id] error:', err);
    return NextResponse.json(
      { error: 'Impossible de supprimer cet article.' },
      { status: 500 },
    );
  }
}

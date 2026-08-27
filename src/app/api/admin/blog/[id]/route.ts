import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { BlogService } from '@/services/blogService';
import type { BlogPostInsert, BlogPostStatus } from '@/types/blog';

const ALLOWED_STATUSES: BlogPostStatus[] = ['draft', 'published', 'archived'];

function normalizePatch(body: Record<string, unknown>): Partial<BlogPostInsert> {
  const patch: Record<string, unknown> = {};

  if (typeof body.title === 'string') patch.title = body.title.trim();
  // Slug vide → non envoyé : le service conserve le slug existant.
  if (typeof body.slug === 'string' && body.slug.trim()) patch.slug = body.slug.trim();

  if (typeof body.excerpt === 'string') patch.excerpt = body.excerpt.trim() || null;
  else if (body.excerpt === null) patch.excerpt = null;

  if (typeof body.content === 'string') patch.content = body.content.trim();

  if (typeof body.cover_image === 'string') patch.cover_image = body.cover_image.trim() || null;
  else if (body.cover_image === null) patch.cover_image = null;

  if (typeof body.author === 'string') patch.author = body.author.trim() || undefined;
  if (typeof body.tags === 'string') patch.tags = body.tags.trim() || null;
  else if (body.tags === null) patch.tags = null;

  if (
    typeof body.status === 'string' &&
    ALLOWED_STATUSES.includes(body.status as BlogPostStatus)
  ) {
    patch.status = body.status as BlogPostStatus;
  }

  if (typeof body.published_at === 'string') patch.published_at = body.published_at.trim() || null;
  else if (body.published_at === null) patch.published_at = null;

  return patch;
}

function revalidateBlogPages() {
  revalidatePath('/blog');
  revalidatePath('/cz7tk/blog');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch = normalizePatch(body);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'Aucune modification valide n’a été fournie.' },
        { status: 400 }
      );
    }

    const updated = await BlogService.update(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
    }

    revalidateBlogPages();
    revalidatePath(`/blog/${updated.slug}`);
    return NextResponse.json({ ok: true, post: updated });
  } catch (err) {
    console.error('PATCH /api/admin/blog/[id] error:', err);
    const message = err instanceof Error ? err.message : '';
    if (/UNIQUE constraint|duplicate key/i.test(message)) {
      return NextResponse.json(
        { error: 'Un article existe déjà avec ce slug (adresse d’URL).' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: message || 'Impossible de mettre à jour cet article.' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const removed = await BlogService.remove(id);
    if (!removed) {
      return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
    }

    revalidateBlogPages();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/blog/[id] error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Impossible de supprimer cet article.',
      },
      { status: 500 }
    );
  }
}

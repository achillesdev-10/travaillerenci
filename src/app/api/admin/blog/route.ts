import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { BlogService } from '@/services/blogService';
import type { BlogPostInsert, BlogPostStatus } from '@/types/blog';

const ALLOWED_STATUSES: BlogPostStatus[] = ['draft', 'published', 'archived'];

function normalizeBody(body: Record<string, unknown>): Partial<BlogPostInsert> {
  const data: Record<string, unknown> = {};

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (typeof body.slug === 'string' && body.slug.trim()) data.slug = body.slug.trim();

  if (typeof body.excerpt === 'string') data.excerpt = body.excerpt.trim() || null;
  else if (body.excerpt === null) data.excerpt = null;

  if (typeof body.content === 'string' && body.content.trim()) data.content = body.content.trim();

  if (typeof body.cover_image === 'string') data.cover_image = body.cover_image.trim() || null;
  else if (body.cover_image === null) data.cover_image = null;

  if (typeof body.author === 'string') data.author = body.author.trim() || undefined;
  if (typeof body.tags === 'string') data.tags = body.tags.trim() || null;
  else if (body.tags === null) data.tags = null;

  if (
    typeof body.status === 'string' &&
    ALLOWED_STATUSES.includes(body.status as BlogPostStatus)
  ) {
    data.status = body.status as BlogPostStatus;
  }

  if (typeof body.published_at === 'string') data.published_at = body.published_at.trim() || null;
  else if (body.published_at === null) data.published_at = null;

  return data;
}

function revalidateBlogPages() {
  revalidatePath('/blog');
  revalidatePath('/achilles/blog');
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const keyword = searchParams.get('q') || undefined;

  try {
    const { rows, total } = await BlogService.list({
      status: status && ALLOWED_STATUSES.includes(status as BlogPostStatus)
        ? (status as BlogPostStatus)
        : undefined,
      keyword: keyword || undefined,
      order_by: 'created_at',
      order_dir: 'desc',
      limit: 200,
    });
    return NextResponse.json({ ok: true, posts: rows, total });
  } catch (err) {
    console.error('GET /api/admin/blog error:', err);
    return NextResponse.json(
      { error: 'Impossible de charger les articles.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = normalizeBody(body);

    if (!data.title || !data.content) {
      return NextResponse.json(
        { error: 'Le titre et le contenu de l’article sont obligatoires.' },
        { status: 400 }
      );
    }

    const created = await BlogService.create(data);
    if (!created) {
      return NextResponse.json(
        { error: 'Impossible de créer l’article.' },
        { status: 500 }
      );
    }

    revalidateBlogPages();
    revalidatePath(`/blog/${created.slug}`);
    return NextResponse.json({ ok: true, post: created }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/blog error:', err);
    const message = err instanceof Error ? err.message : '';
    if (/UNIQUE constraint|duplicate key/i.test(message)) {
      return NextResponse.json(
        { error: 'Un article existe déjà avec ce slug (adresse d’URL).' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: message || 'Impossible de créer cet article.' },
      { status: 500 }
    );
  }
}

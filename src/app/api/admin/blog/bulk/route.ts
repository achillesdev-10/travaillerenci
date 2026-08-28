import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { BlogService } from '@/services/blogService';
import type { BlogPostInsert, BlogPostStatus } from '@/types/blog';
import { slugify } from '@/lib/slugify';

interface BulkArticleInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  cover_image?: string;
  author?: string;
  tags?: string;
  status?: string;
  published_at?: string;
}

function normalizeArticle(raw: BulkArticleInput): Partial<BlogPostInsert> | null {
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const content = typeof raw.content === 'string' ? raw.content.trim() : '';

  if (!title || !content) return null;

  const status = (['draft', 'published', 'archived'].includes(raw.status || '')
    ? raw.status
    : 'draft') as BlogPostStatus;

  return {
    title,
    slug: raw.slug?.trim() || slugify(title),
    excerpt: raw.excerpt?.trim() || null,
    content,
    cover_image: raw.cover_image?.trim() || null,
    author: raw.author?.trim() || 'TravaillerenCi',
    tags: raw.tags?.trim() || null,
    status,
    published_at: raw.published_at?.trim() || (status === 'published' ? new Date().toISOString() : null),
  };
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as { articles?: BulkArticleInput[] };
    const articles = body.articles;

    if (!Array.isArray(articles) || articles.length === 0) {
      return NextResponse.json(
        { error: 'Aucun article fourni pour l\'importation.' },
        { status: 400 }
      );
    }

    if (articles.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 articles par importation.' },
        { status: 400 }
      );
    }

    const normalized = articles
      .map(normalizeArticle)
      .filter((a): a is Partial<BlogPostInsert> => a !== null);

    if (normalized.length === 0) {
      return NextResponse.json(
        { error: 'Aucun article valide trouvé dans les données.' },
        { status: 400 }
      );
    }

    const created: string[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < normalized.length; i++) {
      try {
        const post = await BlogService.create(normalized[i]);
        if (post) {
          created.push(post.id);
        } else {
          errors.push({ index: i + 1, error: 'Échec de la création.' });
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        if (/UNIQUE constraint|duplicate key/i.test(message)) {
          errors.push({ index: i + 1, error: 'Slug déjà utilisé.' });
        } else {
          errors.push({ index: i + 1, error: message });
        }
      }
    }

    revalidatePath('/blog');
    revalidatePath('/cz7tk/blog');

    return NextResponse.json({
      ok: true,
      imported: created.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('POST /api/admin/blog/bulk error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur lors de l\'importation.' },
      { status: 500 }
    );
  }
}

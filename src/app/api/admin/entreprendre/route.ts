import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { EntreprendreArticleService } from '@/services/entreprendreService';
import type {
  EntreprendreArticleInsert,
  EntreprendreArticleStatus,
  EntreprendreSector,
  BudgetRange,
} from '@/types/entreprendre';

const ALLOWED_STATUSES: EntreprendreArticleStatus[] = ['draft', 'published', 'archived'];
const ALLOWED_SECTORS: EntreprendreSector[] = [
  'restauration', 'coiffure-beaute', 'commerce-grossiste', 'commerce-detail',
  'agroalimentaire', 'it-digital', 'transport-logistique', 'btp-immobilier',
  'sante', 'education-formation', 'tourisme-hotellerie', 'artisanat',
  'services-professionnels', 'agriculture', 'autre',
];
const ALLOWED_BUDGETS: BudgetRange[] = ['petit', 'moyen', 'gros'];

function normalizeBody(body: Record<string, unknown>): Partial<EntreprendreArticleInsert> {
  const data: Record<string, unknown> = {};

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (typeof body.slug === 'string' && body.slug.trim()) data.slug = body.slug.trim();
  if (typeof body.excerpt === 'string') data.excerpt = body.excerpt.trim() || null;
  else if (body.excerpt === null) data.excerpt = null;
  if (typeof body.content === 'string' && body.content.trim()) data.content = body.content.trim();
  if (typeof body.cover_image === 'string') data.cover_image = body.cover_image.trim() || null;
  else if (body.cover_image === null) data.cover_image = null;
  if (typeof body.author === 'string') data.author = body.author.trim() || undefined;
  if (typeof body.meta_description === 'string') data.meta_description = body.meta_description.trim() || null;
  else if (body.meta_description === null) data.meta_description = null;

  if (typeof body.status === 'string' && ALLOWED_STATUSES.includes(body.status as EntreprendreArticleStatus)) {
    data.status = body.status as EntreprendreArticleStatus;
  }
  if (typeof body.sector === 'string' && ALLOWED_SECTORS.includes(body.sector as EntreprendreSector)) {
    data.sector = body.sector as EntreprendreSector;
  }
  if (typeof body.budget_range === 'string' && ALLOWED_BUDGETS.includes(body.budget_range as BudgetRange)) {
    data.budget_range = body.budget_range as BudgetRange;
  }
  if (typeof body.reading_time === 'number' && body.reading_time > 0) {
    data.reading_time = Math.min(Math.round(body.reading_time), 120);
  }
  if (typeof body.featured === 'boolean') {
    data.featured = body.featured;
  }
  if (typeof body.published_at === 'string') data.published_at = body.published_at.trim() || null;
  else if (body.published_at === null) data.published_at = null;

  return data;
}

function revalidatePages() {
  revalidatePath('/entreprendre');
  revalidatePath('/cz7tk/entreprendre');
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const keyword = searchParams.get('q') || undefined;
  const sector = searchParams.get('sector') || undefined;

  try {
    const filters: Parameters<typeof EntreprendreArticleService.list>[0] = {
      order_by: 'created_at',
      order_dir: 'desc',
      limit: 200,
    };
    if (status && ALLOWED_STATUSES.includes(status as EntreprendreArticleStatus)) {
      filters.status = status as EntreprendreArticleStatus;
    }
    if (keyword) filters.keyword = keyword;
    if (sector && ALLOWED_SECTORS.includes(sector as EntreprendreSector)) {
      filters.sector = sector as EntreprendreSector;
    }

    const { rows, total } = await EntreprendreArticleService.list(filters);
    return NextResponse.json({ ok: true, articles: rows, total });
  } catch (err) {
    console.error('GET /api/admin/entreprendre error:', err);
    return NextResponse.json({ error: 'Impossible de charger les articles.' }, { status: 500 });
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
        { error: 'Le titre et le contenu sont obligatoires.' },
        { status: 400 },
      );
    }

    const created = await EntreprendreArticleService.create(data);
    if (!created) {
      return NextResponse.json({ error: 'Impossible de créer l\'article.' }, { status: 500 });
    }

    revalidatePages();
    revalidatePath(`/entreprendre/${created.slug}`);
    return NextResponse.json({ ok: true, article: created }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/entreprendre error:', err);
    const message = err instanceof Error ? err.message : '';
    if (/UNIQUE constraint|duplicate key/i.test(message)) {
      return NextResponse.json(
        { error: 'Un article existe déjà avec ce slug.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message || 'Impossible de créer cet article.' }, { status: 500 });
  }
}

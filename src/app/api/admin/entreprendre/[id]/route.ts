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

function normalizePatch(body: Record<string, unknown>): Partial<EntreprendreArticleInsert> {
  const patch: Record<string, unknown> = {};

  if (typeof body.title === 'string') patch.title = body.title.trim();
  if (typeof body.slug === 'string' && body.slug.trim()) patch.slug = body.slug.trim();
  if (typeof body.excerpt === 'string') patch.excerpt = body.excerpt.trim() || null;
  else if (body.excerpt === null) patch.excerpt = null;
  if (typeof body.content === 'string') patch.content = body.content.trim();
  if (typeof body.cover_image === 'string') patch.cover_image = body.cover_image.trim() || null;
  else if (body.cover_image === null) patch.cover_image = null;
  if (typeof body.author === 'string') patch.author = body.author.trim() || undefined;
  if (typeof body.meta_description === 'string') patch.meta_description = body.meta_description.trim() || null;
  else if (body.meta_description === null) patch.meta_description = null;

  if (typeof body.status === 'string' && ALLOWED_STATUSES.includes(body.status as EntreprendreArticleStatus)) {
    patch.status = body.status as EntreprendreArticleStatus;
  }
  if (typeof body.sector === 'string' && ALLOWED_SECTORS.includes(body.sector as EntreprendreSector)) {
    patch.sector = body.sector as EntreprendreSector;
  }
  if (typeof body.budget_range === 'string' && ALLOWED_BUDGETS.includes(body.budget_range as BudgetRange)) {
    patch.budget_range = body.budget_range as BudgetRange;
  }
  if (typeof body.reading_time === 'number' && body.reading_time > 0) {
    patch.reading_time = Math.min(Math.round(body.reading_time), 120);
  }
  if (typeof body.featured === 'boolean') {
    patch.featured = body.featured;
  }
  if (typeof body.published_at === 'string') patch.published_at = body.published_at.trim() || null;
  else if (body.published_at === null) patch.published_at = null;

  return patch;
}

function revalidatePages(slug?: string) {
  revalidatePath('/entreprendre');
  revalidatePath('/cz7tk/entreprendre');
  if (slug) revalidatePath(`/entreprendre/${slug}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const patch = normalizePatch(body);

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'Aucune modification valide n\'a été fournie.' },
        { status: 400 },
      );
    }

    const updated = await EntreprendreArticleService.update(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
    }

    revalidatePages(updated.slug);
    return NextResponse.json({ ok: true, article: updated });
  } catch (err) {
    console.error('PATCH /api/admin/entreprendre/[id] error:', err);
    const message = err instanceof Error ? err.message : '';
    if (/UNIQUE constraint|duplicate key/i.test(message)) {
      return NextResponse.json(
        { error: 'Un article existe déjà avec ce slug.' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message || 'Impossible de mettre à jour cet article.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(_request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const removed = await EntreprendreArticleService.remove(id);
    if (!removed) {
      return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
    }

    revalidatePages();
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/entreprendre/[id] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Impossible de supprimer cet article.' },
      { status: 500 },
    );
  }
}

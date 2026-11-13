import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { revalidateArticleSurfaces } from '@/lib/revalidateContent';
import { buildContentHash, normalizeTitle } from '@/lib/news/dedupe';
import { NEWS_CATEGORIES } from '@/lib/news/categories';
import { NewsRepository } from '@/lib/news/repository';
import { ArticleService } from '@/services/articleService';
import type {
  ArticleAdminAction,
  ArticleCategory,
  ArticleInsert,
  ArticleStatus,
} from '@/types/article';

const ALLOWED_STATUSES: ArticleStatus[] = [
  'draft',
  'pending_review',
  'published',
  'archived',
  'rejected',
];

const ALLOWED_ACTIONS: ArticleAdminAction[] = [
  'publish',
  'reject',
  'archive',
  'draft',
  'disable_auto',
];

const ALLOWED_CATEGORIES = new Set<string>(NEWS_CATEGORIES.map((item) => item.value));

const EDITABLE_FIELDS = [
  'title',
  'excerpt',
  'content',
  'category',
  'cover_image',
  'source_url',
  'seo_title',
  'seo_description',
  'seo_keywords',
] as const;

function cleanString(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

function buildEditorPatch(input: unknown): Partial<ArticleInsert> {
  if (!input || typeof input !== 'object') return {};
  const raw = input as Record<string, unknown>;
  const patch: Partial<ArticleInsert> = {};

  for (const field of EDITABLE_FIELDS) {
    if (!(field in raw)) continue;
    if (field === 'category') {
      const category = String(raw.category ?? '');
      if (ALLOWED_CATEGORIES.has(category)) patch.category = category as ArticleCategory;
      continue;
    }
    if (field === 'cover_image' || field === 'source_url') {
      const value = cleanString(raw[field], 800);
      patch[field] = value ?? null;
      continue;
    }
    const max = field === 'content' ? 60_000 : field === 'title' ? 200 : 400;
    const value = cleanString(raw[field], max);
    if (value !== null) patch[field] = value;
  }
  return patch;
}

function buildActionPatch(
  action: ArticleAdminAction,
  reason: string | null,
): Partial<ArticleInsert> {
  const now = new Date().toISOString();
  const base: Partial<ArticleInsert> = {
    admin_action: action,
    admin_action_at: now,
  };

  switch (action) {
    case 'publish':
      return {
        ...base,
        status: 'published',
        published_at: now,
        published_by: 'admin',
        rejection_reason: null,
        archived_at: null,
      };
    case 'reject':
      return {
        ...base,
        status: 'rejected',
        rejection_reason: reason || 'Rejeté par la rédaction.',
        published_at: null,
      };
    case 'archive':
      return {
        ...base,
        status: 'archived',
        archived_at: now,
      };
    case 'draft':
      return {
        ...base,
        status: 'draft',
        published_at: null,
        archived_at: null,
      };
    case 'disable_auto':
      return {
        ...base,
        auto_publish: false,
      };
    default:
      return base;
  }
}

/**
 * PATCH /api/admin/articles/[id]
 * Body accepté :
 *   { status }                       → changement de statut historique
 *   { action, reason? }              → décision éditoriale (publish/reject/archive/...)
 *   { article: { ... } }             → sauvegarde de l'éditeur
 *   { action, article, reason? }     → les deux en une requête
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
    const existing = await ArticleService.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Article introuvable.' }, { status: 404 });
    }

    const patch: Partial<ArticleInsert> = buildEditorPatch(body.article);
    const rawAction = typeof body.action === 'string' ? body.action : null;
    const rawStatus = typeof body.status === 'string' ? body.status : null;
    const reason = cleanString(body.reason, 400);

    let action: ArticleAdminAction | null = null;
    if (rawAction) {
      if (!ALLOWED_ACTIONS.includes(rawAction as ArticleAdminAction)) {
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
      }
      action = rawAction as ArticleAdminAction;
      Object.assign(patch, buildActionPatch(action, reason));
    } else if (rawStatus) {
      if (!ALLOWED_STATUSES.includes(rawStatus as ArticleStatus)) {
        return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
      }
      patch.status = rawStatus as ArticleStatus;
      patch.admin_action_at = new Date().toISOString();
      if (rawStatus === 'published') {
        patch.published_by = 'admin';
        patch.published_at = existing.published_at || new Date().toISOString();
      }
      if (rawStatus === 'draft') patch.published_at = null;
      if (rawStatus === 'archived') patch.archived_at = new Date().toISOString();
    }

    const hasEditorChanges = Object.keys(buildEditorPatch(body.article)).length > 0;
    if (hasEditorChanges) {
      // Trace l'édition : la publication automatique peut continuer (la requête
      // SQL accepte admin_action = 'edited') mais l'action reste journalisée.
      if (!action && !rawStatus) patch.admin_action = 'edited';
      patch.manually_edited = true;
      const nextTitle = patch.title ?? existing.title;
      const nextContent = patch.content ?? existing.content;
      patch.title_normalized = normalizeTitle(nextTitle);
      patch.content_hash = buildContentHash(nextTitle, nextContent);
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Aucune modification fournie.' }, { status: 400 });
    }

    if (patch.status === 'published') {
      const duplicate = await NewsRepository.findPublishedDuplicate({
        excludeId: id,
        contentHash: patch.content_hash ?? existing.content_hash ?? null,
        titleNormalized: patch.title_normalized ?? existing.title_normalized ?? null,
      }).catch(() => null);
      if (duplicate) {
        return NextResponse.json(
          { error: `Un article publié similaire existe déjà : ${duplicate.slug}` },
          { status: 409 },
        );
      }
    }

    const updated = await ArticleService.update(id, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Impossible de modifier cet article.' }, { status: 500 });
    }

    revalidateArticleSurfaces([updated.slug]);

    await NewsRepository.logAction({
      article_id: updated.id,
      article_slug: updated.slug,
      article_title: updated.title,
      action: action || (patch.status ? `status:${patch.status}` : 'edit'),
      actor: auth.session?.email || 'admin',
      reason,
      details: {
        fields: Object.keys(patch),
        status: updated.status,
      },
    }).catch(() => undefined);

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

    revalidateArticleSurfaces([existing?.slug]);

    if (existing) {
      await NewsRepository.logAction({
        article_id: existing.id,
        article_slug: existing.slug,
        article_title: existing.title,
        action: 'delete',
        actor: auth.session?.email || 'admin',
        details: { status: existing.status },
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/articles/[id] error:', err);
    return NextResponse.json(
      { error: 'Impossible de supprimer cet article.' },
      { status: 500 },
    );
  }
}

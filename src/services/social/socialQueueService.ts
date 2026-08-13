/**
 *  TravaillerEnCi — src/services/social/socialQueueService.ts
 *  Cœur du système de distribution sociale.
 *
 *  Pipeline :
 *    contenu publié sur TravaillerEnCi (status='published')
 *      ↓ enqueuePublishedContent()   (scan + déduplication)
 *    social_posts (queued)
 *      ↓ scheduleQueued()
 *    scheduled (créneaux progressifs + limites quotidiennes)
 *      ↓ processDue()  [worker /api/cron/social-publisher]
 *    publishing → published | failed (retry avec backoff)
 *
 *  Garanties :
 *   • Publication automatique FACEBOOK UNIQUEMENT pour le moment — LinkedIn est
 *     réactivable via SOCIAL_LINKEDIN_ENABLED=true une fois la Page Organisation
 *     connectée (voir config.ts → getEnabledPlatforms).
 *   • Anti-doublon : UNIQUE (content_type, content_id, platform).
 *   • Idempotence : réclamation atomique (queued|scheduled → publishing).
 *   • Contenu expiré : jamais publié (marqué 'ignored').
 *   • Dry-run (SOCIAL_DRY_RUN=true) : payload généré, aucun envoi réel.
 *   • Aucun secret dans les logs / erreurs.
 */

import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { ExamService } from '@/services/examService';
import { getSiteUrl } from '@/lib/site';
import type { JobOfferSchema } from '@/types';
import type { Exam } from '@/types/exam';
import type {
  SocialPlatform,
  SocialPost,
  SocialPreviewPayload,
} from '@/types/social';
import {
  getDailyLimit,
  getEnabledPlatforms,
  getMaxRetries,
  getPublishSlots,
  isFacebookConfigured,
  isLinkedInConfigured,
  isSocialDryRun,
} from './config';
import {
  factsFromContent,
  factsFromExam,
  factsFromJob as factsFromJobOffer,
  type SocialContentFacts,
} from './facts';
import { computePriority } from './priority';
import { buildShareUrl } from './utm';
import { buildSocialText } from './templates';
import { enhanceSocialText } from './aiEnhancer';
import { buildSocialSvg, svgToDataUri, svgToPng } from './image';
import { nextPublishTimes, remainingQuota, retryBackoffMinutes } from './limits';
import { publishFacebookPhoto } from './providers/facebook';
import { publishLinkedInPost } from './providers/linkedin';
import { SocialPostService, type SocialPostRepo } from './socialPostService';

// -----------------------------------------------------------------------------
//  Logs (jamais de secret)
// -----------------------------------------------------------------------------

function logInfo(message: string) {
  console.log(`[SocialPublisher] ${message}`);
}

function logError(message: string) {
  console.error(`[SocialPublisher] ${message}`);
}

/** Assainit un message d'erreur avant stockage/affichage (jamais de token). */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/access_token=([^&\s]+)/g, 'access_token=***')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer ***')
    .slice(0, 500);
}

// -----------------------------------------------------------------------------
//  Résolution du contenu source
// -----------------------------------------------------------------------------

/** Résolveur injectable (tests) — par défaut les services réels. */
export type ContentResolver = (
  contentType: SocialPost['content_type'],
  contentId: string,
) => Promise<JobOfferSchema | Exam | null>;

let contentResolverOverride: ContentResolver | null = null;

export function __setContentResolver(resolver: ContentResolver | null): void {
  contentResolverOverride = resolver;
}

async function resolveContent(
  contentType: SocialPost['content_type'],
  contentId: string,
): Promise<JobOfferSchema | Exam | null> {
  if (contentResolverOverride) {
    return contentResolverOverride(contentType, contentId);
  }
  if (contentType === 'exam') {
    return ExamService.getById(contentId);
  }
  return JobOfferSchemaService.getById(contentId);
}

// -----------------------------------------------------------------------------
//  Enfilement (scan des contenus publiés)
// -----------------------------------------------------------------------------

function isPlatformConfigured(platform: SocialPlatform): boolean {
  return platform === 'facebook' ? isFacebookConfigured() : isLinkedInConfigured();
}

/** Score de priorité d'un contenu (déterministe). */
function priorityFor(facts: SocialContentFacts): number {
  return computePriority({
    contentType: facts.type,
    deadline: facts.deadline,
    hasCompany: Boolean(facts.company),
    hasLocation: Boolean(facts.location),
    hasContractType: Boolean(facts.contractType),
    hasDescription: Boolean(facts.description),
    hasApplyMethod: true,
    hasDeadline: Boolean(facts.deadline),
  });
}

/**
 * Enfile une tâche sociale pour un contenu publié (une par plateforme
 * configurée). Dédupliqué par la contrainte UNIQUE (content_type, content_id,
 * platform). Ne fait RIEN pour les contenus non publiés ou expirés.
 */
export async function enqueueForContent(
  repo: SocialPostRepo,
  facts: SocialContentFacts,
): Promise<number> {
  if (facts.expired) return 0;
  let created = 0;
  // Facebook uniquement par défaut (LinkedIn réactivable via SOCIAL_LINKEDIN_ENABLED).
  const platforms = getEnabledPlatforms();
  for (const platform of platforms) {
    if (!isPlatformConfigured(platform)) continue;
    const existing = await repo.findForContent(facts.type, facts.id, platform);
    if (existing) continue;
    const row = await repo.create({
      content_type: facts.type,
      content_id: facts.id,
      content_title: facts.title,
      platform,
      status: 'queued',
      priority: priorityFor(facts),
    });
    if (row) created += 1;
  }
  return created;
}

/**
 * Scan des contenus PUBLIÉS (job_offers + exams) et enfilement des tâches
 * sociales manquantes. Idempotent : exécuté à chaque run du worker, il ne
 * crée jamais de doublon.
 */
export async function enqueuePublishedContent(maxItems: number = 1000): Promise<number> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return 0;

  let created = 0;

  // 1. Contenus unifiés (job / internship / scholarship) — table job_offers.
  let offset = 0;
  const pageSize = 200;
  while (offset < maxItems) {
    const { rows } = await JobOfferSchemaService.list({
      status: 'published',
      is_archived: false,
      is_expired: false,
      limit: pageSize,
      offset,
      order_by: 'created_at',
      order_dir: 'desc',
    });
    if (rows.length === 0) break;
    for (const job of rows) {
      created += await enqueueForContent(repo, factsFromJobOffer(job));
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }

  // 2. Concours — table exams.
  offset = 0;
  while (offset < maxItems) {
    const { rows } = await ExamService.list({
      status: 'published',
      limit: pageSize,
      offset,
      order_by: 'created_at',
      order_dir: 'desc',
    });
    if (rows.length === 0) break;
    for (const exam of rows) {
      created += await enqueueForContent(repo, factsFromExam(exam));
    }
    offset += pageSize;
    if (rows.length < pageSize) break;
  }

  if (created > 0) logInfo(`enqueuePublishedContent : ${created} tâche(s) créée(s).`);
  return created;
}

// -----------------------------------------------------------------------------
//  Programmation (créneaux progressifs + limites)
// -----------------------------------------------------------------------------

/**
 * Programme les tâches en attente ('queued') sur les prochains créneaux,
 * en respectant les limites quotidiennes de chaque plateforme.
 */
export async function scheduleQueued(now: Date = new Date()): Promise<number> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return 0;

  let scheduled = 0;
  const platforms = getEnabledPlatforms();

  for (const platform of platforms) {
    if (!isPlatformConfigured(platform)) continue;
    const { rows } = await repo.list({ status: 'queued', platform, limit: 200 });
    if (rows.length === 0) continue;

    const slots = getPublishSlots();
    const dailyLimit = getDailyLimit(platform);
    const usedToday = await repo.countPlatformUsedToday(platform, now.toISOString());
    const times = nextPublishTimes(usedToday, dailyLimit, slots, now, rows.length);

    // Priorité d'abord : les plus urgents prennent les créneaux les plus proches.
    const ordered = [...rows].sort((a, b) => b.priority - a.priority);
    for (let i = 0; i < ordered.length; i += 1) {
      const scheduledAt = times[i];
      if (!scheduledAt) break;
      await repo.update(ordered[i].id, {
        status: 'scheduled',
        scheduled_at: scheduledAt.toISOString(),
      });
      scheduled += 1;
    }
  }

  if (scheduled > 0) logInfo(`scheduleQueued : ${scheduled} tâche(s) programmée(s).`);
  return scheduled;
}

// -----------------------------------------------------------------------------
//  Génération du contenu + payload (texte, image, URL)
// -----------------------------------------------------------------------------

function buildPlatformPayload(
  platform: SocialPlatform,
  facts: SocialContentFacts,
  url: string,
  text: string,
): Record<string, unknown> {
  if (platform === 'facebook') {
    return {
      method: 'POST /{page-id}/photos',
      message: text,
      link: url,
      image: 'image/png générée (1200×630)',
    };
  }
  return {
    method: 'POST /rest/posts (Posts API)',
    commentary: text,
    link: url,
    media: { title: facts.title, altText: `Offre ${facts.title} sur TravaillerEnCi` },
  };
}

/**
 * Génère le payload complet (texte + image + URL + payload plateforme) d'une
 * tâche. Utilisé par l'aperçu admin, le dry-run et la publication réelle.
 */
export async function generatePayload(
  post: SocialPost,
  facts: SocialContentFacts,
): Promise<SocialPreviewPayload> {
  const url = buildShareUrl(getSiteUrl(), facts.type, facts, post.platform);
  const templateText = buildSocialText(post.platform, facts, url);
  const enhanced = await enhanceSocialText(post.platform, facts, templateText, url);
  const svg = buildSocialSvg(facts);
  const payload: SocialPreviewPayload = {
    text: enhanced.text,
    linkUrl: url,
    imageSvg: svg,
    imageDataUri: svgToDataUri(svg),
    platformPayload: buildPlatformPayload(post.platform, facts, url, enhanced.text),
  };
  return payload;
}

// -----------------------------------------------------------------------------
//  Publication d'une tâche (worker + action admin « publier maintenant »)
// -----------------------------------------------------------------------------

/** Providers injectables (tests) — par défaut les providers réels. */
export interface SocialPublishProviders {
  facebook: (image: Buffer, message: string) => Promise<{ externalId: string; permalink: string | null }>;
  linkedin: (image: Buffer, message: string, title: string) => Promise<{ externalId: string; permalink: string | null }>;
}

const defaultProviders: SocialPublishProviders = {
  facebook: publishFacebookPhoto,
  linkedin: publishLinkedInPost,
};

/**
 * Publie (ou simule en dry-run) une tâche déjà réclamée. Gère :
 *  - contenu introuvable / expiré → ignored
 *  - succès → published (+ external_post_id)
 *  - échec → retry avec backoff, sinon failed
 */
async function publishClaimedPost(
  post: SocialPost,
  repo: SocialPostRepo,
  providers: SocialPublishProviders = defaultProviders,
  now: Date = new Date(),
): Promise<void> {
  const dryRun = isSocialDryRun();

  try {
    const content = await resolveContent(post.content_type, post.content_id);
    if (!content) {
      await repo.update(post.id, {
        status: 'ignored',
        error_code: 'CONTENT_MISSING',
        error_message: 'Contenu introuvable en base (supprimé).',
      });
      logInfo(`Job #${post.id} | Platform: ${post.platform} | Status: ignored (contenu introuvable)`);
      return;
    }

    const facts = factsFromContent(post.content_type, content);
    if (facts.expired) {
      await repo.update(post.id, {
        status: 'ignored',
        error_code: 'EXPIRED',
        error_message: 'Contenu expiré — non publié.',
      });
      logInfo(`Job #${post.id} | Platform: ${post.platform} | Status: ignored (expiré)`);
      return;
    }

    const payload = await generatePayload(post, facts);

    if (dryRun) {
      await repo.update(post.id, {
        status: 'published',
        published_at: now.toISOString(),
        dry_run: true,
        external_post_id: 'dry-run',
        text: payload.text,
        link_url: payload.linkUrl,
        payload_json: payload as unknown as Record<string, unknown>,
        error_code: null,
        error_message: null,
      });
      logInfo(`Job #${post.id} | Platform: ${post.platform} | Status: published (DRY-RUN, aucun envoi)`);
      return;
    }

    const imagePng = await svgToPng(payload.imageSvg);
    const result =
      post.platform === 'facebook'
        ? await providers.facebook(imagePng, payload.text)
        : await providers.linkedin(imagePng, payload.text, facts.title);

    await repo.update(post.id, {
      status: 'published',
      published_at: now.toISOString(),
      external_post_id: result.externalId,
      text: payload.text,
      link_url: payload.linkUrl,
      payload_json: payload as unknown as Record<string, unknown>,
      error_code: null,
      error_message: null,
      next_attempt_at: null,
    });
    logInfo(`Job #${post.id} | Platform: ${post.platform} | Status: success | External ID: ${result.externalId}`);
  } catch (error) {
    const attempts = post.attempt_count + 1;
    const maxRetries = getMaxRetries();
    const message = sanitizeErrorMessage(error instanceof Error ? error.message : String(error));
    const code = error instanceof Error ? (error as Error & { code?: string }).code || 'API_ERROR' : 'API_ERROR';

    if (attempts >= maxRetries) {
      await repo.update(post.id, {
        status: 'failed',
        attempt_count: attempts,
        error_code: code,
        error_message: message,
        next_attempt_at: null,
      });
      logError(`Job #${post.id} | Platform: ${post.platform} | Status: failed | Tentatives: ${attempts} | ${message}`);
      return;
    }

    const backoffMinutes = retryBackoffMinutes(attempts);
    const nextAttempt = new Date(now.getTime() + backoffMinutes * 60_000).toISOString();
    await repo.update(post.id, {
      status: 'scheduled',
      attempt_count: attempts,
      error_code: code,
      error_message: message,
      next_attempt_at: nextAttempt,
    });
    logError(`Job #${post.id} | Platform: ${post.platform} | Status: retry dans ${backoffMinutes} min | Tentatives: ${attempts} | ${message}`);
  }
}

/**
 * Worker : traite les tâches dues, plateforme par plateforme, dans la limite
 * quotidienne. Chaque tâche est réclamée atomiquement (anti-concurrence).
 */
export async function processDue(
  now: Date = new Date(),
  providers: SocialPublishProviders = defaultProviders,
): Promise<{
  processed: number;
  published: number;
  failed: number;
  skipped: number;
}> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return { processed: 0, published: 0, failed: 0, skipped: 0 };

  const result = { processed: 0, published: 0, failed: 0, skipped: 0 };
  const platforms = getEnabledPlatforms();

  for (const platform of platforms) {
    if (!isPlatformConfigured(platform)) {
      logInfo(`Platform: ${platform} | non configuré — ignoré.`);
      continue;
    }
    const usedToday = await repo.countPlatformUsedToday(platform, now.toISOString());
    const quota = remainingQuota(usedToday, getDailyLimit(platform));
    if (quota <= 0) {
      logInfo(`Platform: ${platform} | limite quotidienne atteinte (${usedToday}) — ignoré.`);
      result.skipped += 1;
      continue;
    }

    const due = await repo.getDue(platform, now.toISOString(), quota);
    for (const post of due) {
      const claimed = await repo.claim(post.id);
      if (!claimed) {
        // Une autre instance (ou une exécution concurrente) l'a déjà prise.
        result.skipped += 1;
        continue;
      }
      result.processed += 1;
      await publishClaimedPost(claimed, repo, providers, now);
      const after = await repo.getById(post.id);
      if (after?.status === 'published') result.published += 1;
      else if (after?.status === 'failed') result.failed += 1;
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
//  Actions admin
// -----------------------------------------------------------------------------

/** Aperçu (génère le payload sans publier) — renseigne payload_json. */
export async function previewPost(postId: string): Promise<SocialPreviewPayload | null> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return null;
  const post = await repo.getById(postId);
  if (!post) return null;

  const content = await resolveContent(post.content_type, post.content_id);
  if (!content) return null;
  const facts = factsFromContent(post.content_type, content);
  const payload = await generatePayload(post, facts);

  await repo.update(post.id, {
    text: payload.text,
    link_url: payload.linkUrl,
    payload_json: payload as unknown as Record<string, unknown>,
  });
  return payload;
}

/** Publication immédiate (action admin explicite) — ignore la programmation. */
export async function publishNow(
  postId: string,
  providers: SocialPublishProviders = defaultProviders,
): Promise<{ ok: boolean; error?: string }> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return { ok: false, error: 'Base de données indisponible.' };
  const post = await repo.getById(postId);
  if (!post) return { ok: false, error: 'Tâche introuvable.' };
  if (post.status === 'published') {
    return { ok: false, error: 'Déjà publiée sur cette plateforme (anti-doublon).' };
  }
  const claimed = await repo.claim(postId);
  if (!claimed) {
    return { ok: false, error: 'Tâche en cours de traitement par le worker.' };
  }
  await publishClaimedPost(claimed, repo, providers);
  const after = await repo.getById(postId);
  if (after?.status === 'published') return { ok: true };
  return { ok: false, error: after?.error_message || 'Échec de la publication.' };
}

/** Reprogramme une tâche (action admin). */
export async function reschedulePost(
  postId: string,
  scheduledAtIso: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return { ok: false, error: 'Base de données indisponible.' };
  const post = await repo.getById(postId);
  if (!post) return { ok: false, error: 'Tâche introuvable.' };
  if (post.status === 'published') {
    return { ok: false, error: 'Tâche déjà publiée.' };
  }
  await repo.update(postId, {
    status: 'scheduled',
    scheduled_at: scheduledAtIso,
    next_attempt_at: null,
    error_code: null,
    error_message: null,
  });
  return { ok: true };
}

/** Réessaie une tâche échouée (reset attempt_count, repasse en file). */
export async function retryPost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return { ok: false, error: 'Base de données indisponible.' };
  const post = await repo.getById(postId);
  if (!post) return { ok: false, error: 'Tâche introuvable.' };
  if (post.status !== 'failed' && post.status !== 'ignored') {
    return { ok: false, error: 'Seules les tâches échouées ou ignorées peuvent être réessayées.' };
  }
  const next = nextPublishTimes(0, 100, getPublishSlots(), new Date(), 1)[0];
  await repo.update(postId, {
    status: 'queued',
    scheduled_at: null,
    next_attempt_at: null,
    attempt_count: 0,
    error_code: null,
    error_message: null,
    external_post_id: null,
    dry_run: false,
    ...(next ? { scheduled_at: next.toISOString() } : {}),
  });
  return { ok: true };
}

/** Ignore / annule une tâche (action admin). */
export async function setPostStatus(
  postId: string,
  status: 'ignored' | 'cancelled',
  message?: string,
): Promise<{ ok: boolean; error?: string }> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return { ok: false, error: 'Base de données indisponible.' };
  const post = await repo.getById(postId);
  if (!post) return { ok: false, error: 'Tâche introuvable.' };
  if (post.status === 'published') {
    return { ok: false, error: 'Tâche déjà publiée — impossible.' };
  }
  await repo.update(postId, {
    status,
    error_message: message || null,
    next_attempt_at: null,
  });
  return { ok: true };
}

/** Modifie le texte d'une tâche (action admin). */
export async function editPostText(
  postId: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  const repo = await SocialPostService.getRepo();
  if (!repo) return { ok: false, error: 'Base de données indisponible.' };
  const post = await repo.getById(postId);
  if (!post) return { ok: false, error: 'Tâche introuvable.' };
  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: 'Le texte ne peut pas être vide.' };
  await repo.update(postId, { text: trimmed });
  return { ok: true };
}

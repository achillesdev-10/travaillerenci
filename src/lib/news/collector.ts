import type { ArticleSourceRef } from '@/types/article';
import type { NewsAutomationSettings, RssItem } from '@/types/news';
import { generateNewsDraft, type SourceText } from './ai';
import { guessNewsCategory, isRelevantNews, normalizeNewsCategory } from './categories';
import { DEFAULT_NEWS_SETTINGS, normalizeNewsSettings } from './config';
import {
  buildContentHash,
  buildTopicKey,
  clusterNewsItems,
  normalizeTitle,
} from './dedupe';
import { fetchArticleText, fetchFeed } from './fetch';
import { NewsRepository } from './repository';
import { parseRssFeed } from './rss';
import { slugify } from '@/lib/slugify';

export interface CollectionResult {
  status: 'skipped' | 'success' | 'partial' | 'error';
  reason?: string;
  itemsFetched: number;
  itemsNew: number;
  clusters: number;
  articlesCreated: number;
  aiCalls: number;
  durationMs: number;
  errors: string[];
}

async function mapLimit<T, R>(
  values: T[],
  limit: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  const runners = Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (index < values.length) {
      const current = index;
      index += 1;
      results[current] = await worker(values[current]);
    }
  });
  await Promise.all(runners);
  return results;
}

function citationSources(clusterItems: RssItem[]): RssItem[] {
  const seen = new Set<string>();
  return clusterItems
    .filter((item) => item.allowed_for_citation)
    .sort((a, b) => {
      if (b.source_weight !== a.source_weight) return b.source_weight - a.source_weight;
      return (Date.parse(b.published_at ?? '') || 0) - (Date.parse(a.published_at ?? '') || 0);
    })
    .filter((item) => {
      if (seen.has(item.source_id)) return false;
      seen.add(item.source_id);
      return true;
    })
    .slice(0, 3);
}

function toSourceRef(item: RssItem): ArticleSourceRef {
  return {
    source_id: item.source_id,
    name: item.source_name,
    url: item.url,
    title: item.title,
    published_at: item.published_at,
    allowed_for_citation: item.allowed_for_citation,
  };
}

export async function collectNews(options: {
  trigger?: string;
  force?: boolean;
} = {}): Promise<CollectionResult> {
  const started = Date.now();
  const deadline = started + 45_000;
  const errors: string[] = [];
  const trigger = options.trigger || 'manual';
  let runId: number | null = null;
  let itemsFetched = 0;
  let itemsNew = 0;
  let clusterCount = 0;
  let articlesCreated = 0;
  let aiCalls = 0;

  if (!NewsRepository.isAvailable()) {
    return {
      status: 'error',
      reason: 'Supabase non configuré',
      itemsFetched: 0,
      itemsNew: 0,
      clusters: 0,
      articlesCreated: 0,
      aiCalls: 0,
      durationMs: Date.now() - started,
      errors: ['Supabase non configuré'],
    };
  }

  if (!options.force) {
    const should = await NewsRepository.shouldCollect();
    if (!should.should) {
      return {
        status: 'skipped',
        reason: should.reason || 'aucune collecte nécessaire',
        itemsFetched: 0,
        itemsNew: 0,
        clusters: 0,
        articlesCreated: 0,
        aiCalls: 0,
        durationMs: Date.now() - started,
        errors: [],
      };
    }
  }

  const locked = await NewsRepository.acquireLock();
  if (!locked) {
    return {
      status: 'skipped',
      reason: 'collecte déjà en cours',
      itemsFetched: 0,
      itemsNew: 0,
      clusters: 0,
      articlesCreated: 0,
      aiCalls: 0,
      durationMs: Date.now() - started,
      errors: [],
    };
  }

  try {
    const settings: NewsAutomationSettings = normalizeNewsSettings(
      await NewsRepository.getSettings().catch(() => DEFAULT_NEWS_SETTINGS),
    );
    if (!settings.enabled) {
      return {
        status: 'skipped',
        reason: 'automatisation désactivée',
        itemsFetched: 0,
        itemsNew: 0,
        clusters: 0,
        articlesCreated: 0,
        aiCalls: 0,
        durationMs: Date.now() - started,
        errors: [],
      };
    }

    const sources = await NewsRepository.listEnabledSources();
    if (sources.length === 0) {
      return {
        status: 'skipped',
        reason: 'aucune source activée',
        itemsFetched: 0,
        itemsNew: 0,
        clusters: 0,
        articlesCreated: 0,
        aiCalls: 0,
        durationMs: Date.now() - started,
        errors: [],
      };
    }

    const run = await NewsRepository.startRun(trigger);
    runId = run?.id ?? null;

    const stats = await NewsRepository.stats().catch(() => null);
    const aiRemaining = Math.max(0, settings.max_ai_calls_per_day - (stats?.aiCallsToday ?? 0));
    let quota = Math.min(
      settings.daily_limit,
      await NewsRepository.remainingQuota().catch(() => 0),
    );

    const fetched = await mapLimit(sources, 2, async (source) => {
      try {
        const feed = await fetchFeed(source.feed_url, {
          etag: source.etag,
          lastModified: source.last_modified,
        });

        if (feed.status === 304) {
          await NewsRepository.updateSourceHealth(source.id, {
            last_fetched_at: new Date().toISOString(),
            last_status: 304,
            last_error: null,
            etag: source.etag,
            last_modified: source.last_modified,
            error_count: 0,
          });
          return [] as RssItem[];
        }

        if (feed.status < 200 || feed.status >= 300 || !feed.xml) {
          throw new Error(`HTTP ${feed.status}`);
        }

        const parsed = parseRssFeed(feed.xml, source, {
          maxItems: 25,
          maxAgeHours: settings.max_item_age_hours,
        }).filter((item) => isRelevantNews(item.title, item.summary));

        await NewsRepository.updateSourceHealth(source.id, {
          last_fetched_at: new Date().toISOString(),
          last_status: feed.status,
          last_error: null,
          etag: feed.etag,
          last_modified: feed.lastModified,
          error_count: 0,
        });

        return parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${source.id}: ${message}`);
        await NewsRepository.updateSourceHealth(source.id, {
          last_fetched_at: new Date().toISOString(),
          last_status: null,
          last_error: message.slice(0, 300),
          error_count: (source.error_count ?? 0) + 1,
        }).catch(() => undefined);
        return [] as RssItem[];
      }
    });

    const allItems = fetched.flat();
    itemsFetched = allItems.length;

    const uniqueItems: RssItem[] = [];
    const seenUrls = new Set<string>();
    const seenTitles = new Set<string>();
    for (const item of allItems) {
      if (seenUrls.has(item.url_key)) continue;
      if (seenTitles.has(item.title_hash) && !item.allowed_for_citation) continue;
      seenUrls.add(item.url_key);
      seenTitles.add(item.title_hash);
      uniqueItems.push(item);
    }

    const claimed: Array<{ item: RssItem; seenId: number }> = [];
    for (const item of uniqueItems) {
      if (Date.now() > deadline) break;
      const seenId = await NewsRepository.claimItem(item).catch(() => null);
      if (seenId) claimed.push({ item, seenId });
    }
    itemsNew = claimed.length;

    const clusters = clusterNewsItems(
      claimed.map((entry) => entry.item),
      Math.max(settings.max_candidates * 2, 10),
    ).filter((cluster) => citationSources(cluster.items).length > 0);
    clusterCount = clusters.length;

    const maxToCreate = Math.min(
      settings.max_new_articles_per_run,
      quota,
      aiRemaining,
      settings.max_candidates,
    );

    for (const cluster of clusters) {
      if (articlesCreated >= maxToCreate) break;
      if (Date.now() > deadline) break;
      if (quota <= 0 || aiCalls >= aiRemaining) break;

      const uniqueTitle = normalizeTitle(cluster.title);
      const alreadyExists = await NewsRepository.topicExists(uniqueTitle).catch(() => false);
      if (alreadyExists) continue;

      const citation = citationSources(cluster.items);
      if (citation.length === 0) continue;

      const sourceTexts: SourceText[] = await Promise.all(
        citation.slice(0, 2).map(async (item) => {
          const fullText = await fetchArticleText(item.url).catch(() => null);
          return {
            name: item.source_name,
            url: item.url,
            published_at: item.published_at,
            text: fullText || item.summary || item.title,
          };
        }),
      );

      if (sourceTexts.every((source) => source.text.trim().length < 80)) continue;

      aiCalls += 1;
      const generated = await generateNewsDraft(cluster, sourceTexts);
      if (!generated) {
        errors.push(`IA: aucun brouillon publiable pour « ${cluster.title.slice(0, 80)} »`);
        continue;
      }
      const { draft, model: aiModel } = generated;

      const category = normalizeNewsCategory(draft.category || guessNewsCategory(draft.title));
      const titleNormalized = normalizeTitle(draft.title);
      const duplicate = await NewsRepository.topicExists(titleNormalized).catch(() => false);
      if (duplicate) continue;

      const usedUrls = new Set(draft.used_source_urls);
      const sourcesForArticle = citation.filter(
        (item) => usedUrls.size === 0 || usedUrls.has(item.url),
      );
      const finalSources = sourcesForArticle.length > 0 ? sourcesForArticle : citation.slice(0, 2);

      const seenIds = claimed
        .filter((entry) =>
          finalSources.some((source) => source.url === entry.item.url),
        )
        .map((entry) => entry.seenId);

      const createdId = await NewsRepository.createArticle({
        title: draft.title,
        slug: slugify(draft.title),
        excerpt: draft.excerpt,
        content: draft.content,
        category,
        source_url: finalSources[0]?.url ?? null,
        cover_image: null,
        author: 'Rédaction TravaillerEnCi',
        sources: finalSources.map(toSourceRef),
        topic_key: buildTopicKey(draft.title),
        content_hash: buildContentHash(draft.title, draft.content),
        title_normalized: titleNormalized,
        ai_model: aiModel,
        ai_confidence: draft.confidence,
        seen_ids: seenIds,
        seo_title: draft.seo_title ?? null,
        seo_description: draft.seo_description ?? null,
        seo_keywords: draft.seo_keywords ?? null,
      }).catch((error) => {
        errors.push(`Création: ${error instanceof Error ? error.message : String(error)}`);
        return null;
      });

      if (createdId) {
        articlesCreated += 1;
        quota -= 1;
      }
    }

    if (runId != null) {
      await NewsRepository.finishRun(runId, {
        status:
          articlesCreated > 0
            ? errors.length > 0
              ? 'partial'
              : 'success'
            : errors.length > 0
              ? 'error'
              : 'success',
        items_fetched: itemsFetched,
        items_new: itemsNew,
        clusters: clusterCount,
        articles_created: articlesCreated,
        ai_calls: aiCalls,
        errors: errors.slice(0, 20),
        duration_ms: Date.now() - started,
      }).catch(() => undefined);
    }

    return {
      status:
        articlesCreated > 0
          ? errors.length > 0
            ? 'partial'
            : 'success'
          : errors.length > 0
            ? 'error'
            : 'success',
      itemsFetched,
      itemsNew,
      clusters: clusterCount,
      articlesCreated,
      aiCalls,
      durationMs: Date.now() - started,
      errors,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    errors.push(message);
    if (runId != null) {
      await NewsRepository.finishRun(runId, {
        status: 'error',
        items_fetched: itemsFetched,
        items_new: itemsNew,
        clusters: clusterCount,
        articles_created: articlesCreated,
        ai_calls: aiCalls,
        errors: errors.slice(0, 20),
        duration_ms: Date.now() - started,
      }).catch(() => undefined);
    }
    return {
      status: 'error',
      reason: message,
      itemsFetched,
      itemsNew,
      clusters: clusterCount,
      articlesCreated,
      aiCalls,
      durationMs: Date.now() - started,
      errors,
    };
  } finally {
    await NewsRepository.releaseLock().catch(() => undefined);
  }
}

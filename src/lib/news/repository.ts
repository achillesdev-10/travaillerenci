import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import type { ArticleSourceRef } from '@/types/article';
import type {
  NewsAutomationSettings,
  NewsPipelineRun,
  NewsSource,
  NewsStats,
  RssItem,
} from '@/types/news';
import { DEFAULT_NEWS_SETTINGS, normalizeNewsSettings } from './config';

export interface NewsArticlePayload {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  category: string;
  source_url: string | null;
  cover_image: string | null;
  author: string;
  sources: ArticleSourceRef[];
  topic_key: string;
  content_hash: string;
  title_normalized: string;
  ai_model: string | null;
  ai_confidence: number | null;
  seen_ids: number[];
  seo_title?: string | null;
  seo_description?: string | null;
  seo_keywords?: string | null;
}

function requireClient() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error('Supabase non configuré : pipeline actualités indisponible.');
  }
  return supabase;
}

function normalizeSettingValue(value: unknown): unknown {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

export class NewsRepository {
  static isAvailable(): boolean {
    return isSupabaseConfigured();
  }

  // ---------------------------------------------------------------- SETTINGS
  static async getSettings(): Promise<NewsAutomationSettings> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('platform_settings')
      .select('value')
      .eq('key', 'news_automation')
      .maybeSingle();
    if (error || !data) return { ...DEFAULT_NEWS_SETTINGS };
    return normalizeNewsSettings(normalizeSettingValue(data.value));
  }

  static async saveSettings(settings: NewsAutomationSettings): Promise<NewsAutomationSettings> {
    const supabase = requireClient();
    const { error } = await supabase.from('platform_settings').upsert(
      {
        key: 'news_automation',
        value: settings,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' },
    );
    if (error) throw new Error(error.message);
    return settings;
  }

  // ----------------------------------------------------------------- SOURCES
  static async listSources(): Promise<NewsSource[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('news_sources')
      .select('*')
      .order('weight', { ascending: false })
      .order('name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as NewsSource[];
  }

  static async listEnabledSources(): Promise<NewsSource[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('news_sources')
      .select('*')
      .eq('enabled', true)
      .order('weight', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as NewsSource[];
  }

  static async updateSource(
    id: string,
    patch: Partial<Pick<NewsSource, 'enabled' | 'allowed_for_citation' | 'weight'>>,
  ): Promise<NewsSource | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('news_sources')
      .update(patch)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as NewsSource) ?? null;
  }

  static async updateSourceHealth(
    id: string,
    health: {
      last_fetched_at: string;
      last_status: number | null;
      last_error: string | null;
      etag?: string | null;
      last_modified?: string | null;
      error_count: number;
    },
  ): Promise<void> {
    const supabase = requireClient();
    await supabase.from('news_sources').update(health).eq('id', id);
  }

  // -------------------------------------------------------------------- RUNS
  static async startRun(trigger: string): Promise<NewsPipelineRun | null> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('news_pipeline_runs')
      .insert({ status: 'running', trigger })
      .select()
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as NewsPipelineRun) ?? null;
  }

  static async finishRun(
    id: number,
    patch: {
      status: NewsPipelineRun['status'];
      items_fetched: number;
      items_new: number;
      clusters: number;
      articles_created: number;
      ai_calls: number;
      errors: unknown[];
      duration_ms: number;
    },
  ): Promise<void> {
    const supabase = requireClient();
    await supabase
      .from('news_pipeline_runs')
      .update({ ...patch, finished_at: new Date().toISOString() })
      .eq('id', id);
  }

  static async listRuns(limit = 10): Promise<NewsPipelineRun[]> {
    const supabase = requireClient();
    const { data, error } = await supabase
      .from('news_pipeline_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as NewsPipelineRun[];
  }

  static async stats(): Promise<NewsStats> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('news_stats');
    if (error) throw new Error(error.message);
    const raw = (data ?? {}) as Partial<NewsStats>;
    return {
      pending: raw.pending ?? 0,
      published: raw.published ?? 0,
      archived: raw.archived ?? 0,
      rejected: raw.rejected ?? 0,
      draft: raw.draft ?? 0,
      publishedToday: raw.publishedToday ?? 0,
      aiCallsToday: raw.aiCallsToday ?? 0,
      totalViews: raw.totalViews ?? 0,
      lastRun: raw.lastRun ?? null,
    };
  }

  // ------------------------------------------------------------ PIPELINE RPC
  static async shouldCollect(): Promise<{ should: boolean; reason?: string; remainingQuota?: number }> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('news_should_collect');
    if (error) return { should: false, reason: error.message };
    const raw = (data ?? {}) as Record<string, unknown>;
    return {
      should: Boolean(raw.should),
      reason: raw.reason ? String(raw.reason) : undefined,
      remainingQuota: raw.remaining_quota ? Number(raw.remaining_quota) : undefined,
    };
  }

  static async acquireLock(): Promise<boolean> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('news_acquire_collection_lock');
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  static async releaseLock(): Promise<void> {
    const supabase = requireClient();
    await supabase.rpc('news_release_collection_lock');
  }

  static async remainingQuota(): Promise<number> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('news_remaining_quota');
    if (error) return 0;
    return Number(data) || 0;
  }

  static async claimItem(item: RssItem): Promise<number | null> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('news_claim_item', {
      p_url_key: item.url_key,
      p_title_hash: item.title_hash,
      p_source_id: item.source_id,
      p_title: item.title,
      p_url: item.url,
      p_published_at: item.published_at,
      p_summary: item.summary.slice(0, 2500),
    });
    if (error || data == null) return null;
    const id = Number(data);
    return Number.isFinite(id) ? id : null;
  }

  static async topicExists(titleNormalized: string): Promise<boolean> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('news_topic_exists', {
      p_title_normalized: titleNormalized,
    });
    if (error) return false;
    return Boolean(data);
  }

  static async createArticle(payload: NewsArticlePayload): Promise<string | null> {
    const supabase = requireClient();
    const { data, error } = await supabase.rpc('news_create_article', { p_payload: payload });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  }

  static async incrementView(slug: string): Promise<void> {
    const supabase = requireClient();
    await supabase.rpc('news_increment_view', { p_slug: slug });
  }

  // -------------------------------------------------------------------- LOGS
  static async logAction(entry: {
    article_id?: string | null;
    article_slug?: string | null;
    article_title?: string | null;
    action: string;
    actor: string;
    reason?: string | null;
    details?: Record<string, unknown>;
  }): Promise<void> {
    const supabase = requireClient();
    await supabase.from('news_publication_log').insert({
      article_id: entry.article_id ?? null,
      article_slug: entry.article_slug ?? null,
      article_title: entry.article_title ?? null,
      action: entry.action,
      actor: entry.actor,
      reason: entry.reason ?? null,
      details: entry.details ?? {},
    });
  }

  // ------------------------------------------------------------- DUPLICATES
  static async findPublishedDuplicate(input: {
    excludeId?: string;
    contentHash?: string | null;
    titleNormalized?: string | null;
  }): Promise<{ id: string; slug: string } | null> {
    const supabase = requireClient();
    const filters: string[] = [];
    if (input.contentHash) filters.push(`content_hash.eq.${input.contentHash}`);
    if (input.titleNormalized) filters.push(`title_normalized.eq.${input.titleNormalized}`);
    if (filters.length === 0) return null;

    let query = supabase
      .from('articles')
      .select('id,slug')
      .eq('status', 'published')
      .or(filters.join(','))
      .limit(1);
    if (input.excludeId) query = query.neq('id', input.excludeId);
    const { data } = await query;
    return data?.[0] ?? null;
  }
}

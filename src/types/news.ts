/** Types du pipeline d'actualités automatisées (voir migration 0035). */

export interface NewsAutomationSettings {
  enabled: boolean;
  auto_publish_enabled: boolean;
  collect_interval_hours: number;
  review_minutes: number;
  daily_limit: number;
  max_new_articles_per_run: number;
  max_ai_calls_per_day: number;
  min_sources: number;
  min_content_chars: number;
  max_candidates: number;
  max_item_age_hours: number;
  collector_url: string;
  recent_days: number;
  pending_max_hours: number;
  rejected_retention_days: number;
  manual_rejected_retention_days: number;
  published_recent_days: number;
  archived_retention_days: number;
  manual_archived_retention_days: number;
  seen_retention_days: number;
}

export interface NewsSource {
  id: string;
  name: string;
  homepage: string | null;
  feed_url: string;
  language: string;
  allowed_for_citation: boolean;
  enabled: boolean;
  weight: number;
  last_fetched_at: string | null;
  last_status: number | null;
  last_error: string | null;
  etag: string | null;
  last_modified: string | null;
  error_count: number;
}

export interface NewsPipelineRun {
  id: number;
  started_at: string;
  finished_at: string | null;
  status: 'running' | 'success' | 'partial' | 'error' | 'skipped';
  trigger: string;
  items_fetched: number;
  items_new: number;
  clusters: number;
  articles_created: number;
  ai_calls: number;
  errors: unknown[];
  duration_ms: number | null;
}

export interface NewsStats {
  pending: number;
  published: number;
  archived: number;
  rejected: number;
  draft: number;
  publishedToday: number;
  aiCallsToday: number;
  totalViews: number;
  lastRun: NewsPipelineRun | null;
}

/** Élément normalisé extrait d'un flux RSS/Atom. */
export interface RssItem {
  source_id: string;
  source_name: string;
  source_weight: number;
  allowed_for_citation: boolean;
  title: string;
  url: string;
  summary: string;
  published_at: string | null;
  image_url: string | null;
  guid: string | null;
  url_key: string;
  title_hash: string;
  title_normalized: string;
  category: string;
  topic_key?: string;
}

/** Groupe d'éléments traitant du même événement. */
export interface NewsCluster {
  topic_key: string;
  title: string;
  category: string;
  items: RssItem[];
  score: number;
}

export interface AiNewsDraft {
  can_publish: boolean;
  confidence: number;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string;
  used_source_urls: string[];
  facts: string[];
  warnings?: string[];
}

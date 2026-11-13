import type { NewsAutomationSettings } from '@/types/news';

export const DEFAULT_NEWS_SETTINGS: NewsAutomationSettings = {
  enabled: true,
  auto_publish_enabled: true,
  collect_interval_hours: 3,
  review_minutes: 15,
  daily_limit: 5,
  max_new_articles_per_run: 2,
  max_ai_calls_per_day: 8,
  min_sources: 1,
  min_content_chars: 700,
  max_candidates: 10,
  max_item_age_hours: 48,
  collector_url: 'https://travaillerenci.vercel.app/api/news/collect',
  recent_days: 30,
  pending_max_hours: 24,
  rejected_retention_days: 7,
  manual_rejected_retention_days: 30,
  published_recent_days: 30,
  archived_retention_days: 90,
  manual_archived_retention_days: 180,
  seen_retention_days: 30,
};

function asInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return fallback;
}

function asUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeNewsSettings(raw: unknown): NewsAutomationSettings {
  const value = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_NEWS_SETTINGS;
  return {
    enabled: asBool(value.enabled, d.enabled),
    auto_publish_enabled: asBool(value.auto_publish_enabled, d.auto_publish_enabled),
    collect_interval_hours: asInt(value.collect_interval_hours, d.collect_interval_hours, 1, 24),
    review_minutes: asInt(value.review_minutes, d.review_minutes, 1, 120),
    daily_limit: asInt(value.daily_limit, d.daily_limit, 1, 20),
    max_new_articles_per_run: asInt(value.max_new_articles_per_run, d.max_new_articles_per_run, 1, 5),
    max_ai_calls_per_day: asInt(value.max_ai_calls_per_day, d.max_ai_calls_per_day, 1, 30),
    min_sources: asInt(value.min_sources, d.min_sources, 1, 5),
    min_content_chars: asInt(value.min_content_chars, d.min_content_chars, 400, 5000),
    max_candidates: asInt(value.max_candidates, d.max_candidates, 1, 30),
    max_item_age_hours: asInt(value.max_item_age_hours, d.max_item_age_hours, 6, 168),
    collector_url: asUrl(value.collector_url, d.collector_url),
    recent_days: asInt(value.recent_days, d.recent_days, 7, 90),
    pending_max_hours: asInt(value.pending_max_hours, d.pending_max_hours, 1, 72),
    rejected_retention_days: asInt(value.rejected_retention_days, d.rejected_retention_days, 1, 60),
    manual_rejected_retention_days: asInt(
      value.manual_rejected_retention_days,
      d.manual_rejected_retention_days,
      1,
      120,
    ),
    published_recent_days: asInt(value.published_recent_days, d.published_recent_days, 7, 90),
    archived_retention_days: asInt(
      value.archived_retention_days,
      d.archived_retention_days,
      30,
      365,
    ),
    manual_archived_retention_days: asInt(
      value.manual_archived_retention_days,
      d.manual_archived_retention_days,
      30,
      365,
    ),
    seen_retention_days: asInt(value.seen_retention_days, d.seen_retention_days, 7, 180),
  };
}

/** Limites exposées au formulaire admin (garde-fous côté API). */
export const NEWS_SETTINGS_LIMITS = {
  collect_interval_hours: [1, 24],
  review_minutes: [1, 120],
  daily_limit: [1, 20],
  max_new_articles_per_run: [1, 5],
  max_ai_calls_per_day: [1, 30],
  min_sources: [1, 5],
  min_content_chars: [400, 5000],
  max_candidates: [1, 30],
  max_item_age_hours: [6, 168],
} as const;

-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0035
--  Description : système d'actualités originales automatisées.
--
--  Réutilise la table `articles` déjà consommée par :
--    • /actualites (public)
--    • /cz7tk/actualites (modération)
--    • src/services/articleService.ts
--
--  Ajoute uniquement ce qui manque au module existant :
--    • statuts pending_review / rejected + verrou de publication automatique ;
--    • sources multiples, empreinte de contenu, clé de sujet (anti-doublon) ;
--    • sources RSS administrables, journal des collectes et des publications ;
--    • fonctions SQL atomiques (création, publication après 15 min, purge).
--
--  Aucune collecte ni appel IA n'est exécuté par cette migration.
--  Idempotente : peut être rejouée sans perte de données.
-- ============================================================================

-- Similarité de titres (anti-doublon sémantique entre deux collectes).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ----------------------------------------------------------------------------
--  1. Table `articles` (création si absente, puis enrichissement)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.articles (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title           text NOT NULL,
    slug            text NOT NULL UNIQUE,
    excerpt         text NOT NULL DEFAULT '',
    content         text NOT NULL DEFAULT '',
    category        text NOT NULL DEFAULT 'emploi',
    source_url      text,
    cover_image     text,
    author          text NOT NULL DEFAULT 'TravaillerenCi',
    status          text NOT NULL DEFAULT 'draft',
    seo_title       text,
    seo_description text,
    seo_keywords    text,
    published_at    timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS review_deadline     timestamptz;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS auto_publish        boolean NOT NULL DEFAULT false;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS admin_action        text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS admin_action_at     timestamptz;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS rejection_reason    text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS validation_error    text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS validation_checks   jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS sources             jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_count        integer NOT NULL DEFAULT 0;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS topic_key           text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS content_hash        text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS title_normalized    text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS ai_model            text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS ai_confidence       numeric(4,3);
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS manually_edited     boolean NOT NULL DEFAULT false;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS published_by        text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS view_count          integer NOT NULL DEFAULT 0;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS archived_at         timestamptz;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS last_error_at       timestamptz;

-- Contraintes de statut / catégorie : on remplace celles du module existant.
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.articles'::regclass
          AND contype = 'c'
          AND (pg_get_constraintdef(oid) ILIKE '%status%' OR pg_get_constraintdef(oid) ILIKE '%category%')
    LOOP
        EXECUTE format('ALTER TABLE public.articles DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

ALTER TABLE public.articles
    ADD CONSTRAINT articles_status_check
    CHECK (status IN ('draft', 'pending_review', 'published', 'archived', 'rejected'));

ALTER TABLE public.articles
    ADD CONSTRAINT articles_category_check
    CHECK (category IN (
        'emploi', 'formation', 'concours', 'economie', 'carriere', 'guide',
        'societe', 'technologie', 'afrique', 'entrepreneuriat', 'opportunites'
    ));

CREATE INDEX IF NOT EXISTS idx_articles_public_recent
    ON public.articles (published_at DESC)
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_pending_deadline
    ON public.articles (review_deadline)
    WHERE status = 'pending_review';
CREATE INDEX IF NOT EXISTS idx_articles_archived_at
    ON public.articles (archived_at)
    WHERE status = 'archived';
CREATE INDEX IF NOT EXISTS idx_articles_status_created
    ON public.articles (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_topic_key
    ON public.articles (topic_key)
    WHERE topic_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_content_hash
    ON public.articles (content_hash)
    WHERE content_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_title_normalized
    ON public.articles (title_normalized)
    WHERE title_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_title_trgm
    ON public.articles USING gin (title_normalized gin_trgm_ops)
    WHERE title_normalized IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_articles_views
    ON public.articles (published_at DESC, view_count DESC)
    WHERE status = 'published';

-- Un article archivé reste lisible par son URL (SEO) mais n'apparaît plus
-- dans les listes "actualités récentes" qui filtrent status = 'published'.
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "articles lecture publique (publiés et archivés)" ON public.articles;
CREATE POLICY "articles lecture publique (publiés et archivés)"
    ON public.articles FOR SELECT
    USING (status IN ('published', 'archived'));

-- ----------------------------------------------------------------------------
--  2. Sources RSS administrables
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_sources (
    id                    text PRIMARY KEY,
    name                  text NOT NULL,
    homepage              text,
    feed_url              text NOT NULL UNIQUE,
    language              text NOT NULL DEFAULT 'fr',
    allowed_for_citation  boolean NOT NULL DEFAULT true,
    enabled               boolean NOT NULL DEFAULT true,
    weight                integer NOT NULL DEFAULT 1,
    last_fetched_at       timestamptz,
    last_status           integer,
    last_error            text,
    etag                  text,
    last_modified         text,
    error_count           integer NOT NULL DEFAULT 0,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_sources_enabled
    ON public.news_sources (enabled, weight DESC);

-- ----------------------------------------------------------------------------
--  3. Anti-doublon : tous les éléments déjà vus (même non publiés)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_seen_items (
    id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    url_key            text NOT NULL UNIQUE,
    title_hash         text NOT NULL,
    source_id          text REFERENCES public.news_sources(id) ON DELETE CASCADE,
    title              text NOT NULL,
    url                text NOT NULL,
    published_at       timestamptz,
    summary            text,
    topic_key          text,
    used_in_article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
    first_seen_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_seen_title_hash
    ON public.news_seen_items (title_hash);
CREATE INDEX IF NOT EXISTS idx_news_seen_first_seen
    ON public.news_seen_items (first_seen_at);
CREATE INDEX IF NOT EXISTS idx_news_seen_used
    ON public.news_seen_items (used_in_article_id)
    WHERE used_in_article_id IS NOT NULL;

-- ----------------------------------------------------------------------------
--  4. Journal des collectes et des publications
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.news_pipeline_runs (
    id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    started_at       timestamptz NOT NULL DEFAULT now(),
    finished_at      timestamptz,
    status           text NOT NULL DEFAULT 'running'
                     CHECK (status IN ('running', 'success', 'partial', 'error', 'skipped')),
    trigger          text NOT NULL DEFAULT 'cron',
    items_fetched    integer NOT NULL DEFAULT 0,
    items_new        integer NOT NULL DEFAULT 0,
    clusters         integer NOT NULL DEFAULT 0,
    articles_created integer NOT NULL DEFAULT 0,
    ai_calls         integer NOT NULL DEFAULT 0,
    errors           jsonb NOT NULL DEFAULT '[]'::jsonb,
    duration_ms      integer
);

CREATE INDEX IF NOT EXISTS idx_news_runs_started
    ON public.news_pipeline_runs (started_at DESC);

CREATE TABLE IF NOT EXISTS public.news_publication_log (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    article_id    uuid REFERENCES public.articles(id) ON DELETE SET NULL,
    article_slug  text,
    article_title text,
    action        text NOT NULL,
    actor         text NOT NULL DEFAULT 'system',
    reason        text,
    details       jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_news_log_created
    ON public.news_publication_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_log_article
    ON public.news_publication_log (article_id);

-- Verrou de collecte (une seule collecte à la fois, expire après 10 min).
CREATE TABLE IF NOT EXISTS public.news_collect_lock (
    id        integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    locked_at timestamptz,
    run_id    bigint
);
INSERT INTO public.news_collect_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Ces tables sont réservées au service_role (aucune politique publique).
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_seen_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_publication_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_collect_lock ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
--  5. Réglages par défaut (dans la table existante platform_settings)
-- ----------------------------------------------------------------------------
INSERT INTO public.platform_settings (key, value)
VALUES (
    'news_automation',
    jsonb_build_object(
        'enabled', true,
        'auto_publish_enabled', true,
        'collect_interval_hours', 3,
        'review_minutes', 15,
        'daily_limit', 5,
        'max_new_articles_per_run', 2,
        'max_ai_calls_per_day', 8,
        'min_sources', 1,
        'min_content_chars', 700,
        'max_candidates', 10,
        'max_item_age_hours', 48,
        'collector_url', 'https://travaillerenci.vercel.app/api/news/collect',
        'recent_days', 30,
        'pending_max_hours', 24,
        'rejected_retention_days', 7,
        'manual_rejected_retention_days', 30,
        'published_recent_days', 30,
        'archived_retention_days', 90,
        'manual_archived_retention_days', 180,
        'seen_retention_days', 30
    )
)
ON CONFLICT (key) DO NOTHING;

-- ----------------------------------------------------------------------------
--  6. Sources initiales (RSS officiellement accessibles)
--     Google News est utilisé uniquement pour la veille : jamais cité.
-- ----------------------------------------------------------------------------
INSERT INTO public.news_sources
    (id, name, homepage, feed_url, language, allowed_for_citation, enabled, weight)
VALUES
    ('rfi-afrique', 'RFI Afrique', 'https://www.rfi.fr/fr/afrique', 'https://www.rfi.fr/fr/afrique/rss', 'fr', true, true, 3),
    ('bbc-afrique', 'BBC Afrique', 'https://www.bbc.com/afrique', 'https://feeds.bbci.co.uk/afrique/rss.xml', 'fr', true, true, 3),
    ('africanews-fr', 'Africanews', 'https://fr.africanews.com', 'https://fr.africanews.com/feed/rss', 'fr', true, true, 2),
    ('aip', 'Agence Ivoirienne de Presse', 'https://www.aip.ci', 'https://www.aip.ci/feed/', 'fr', true, true, 3),
    ('abidjan-economie', 'Abidjan.net — Économie', 'https://news.abidjan.net', 'https://news.abidjan.net/rss/economie.xml', 'fr', true, true, 2),
    ('abidjan-societe', 'Abidjan.net — Société', 'https://news.abidjan.net', 'https://news.abidjan.net/rss/societe.xml', 'fr', true, true, 2),
    ('abidjan-ntic', 'Abidjan.net — NTIC', 'https://news.abidjan.net', 'https://news.abidjan.net/rss/ntic.xml', 'fr', true, false, 2),
    ('google-news-ci', 'Google News — Côte d''Ivoire (veille)', 'https://news.google.com', 'https://news.google.com/rss/search?q=C%C3%B4te+d%27Ivoire&hl=fr&gl=CI&ceid=CI:fr', 'fr', false, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
--  7. Helpers
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_news_sources_updated_at ON public.news_sources;
CREATE TRIGGER trg_news_sources_updated_at
    BEFORE UPDATE ON public.news_sources
    FOR EACH ROW EXECUTE FUNCTION public.news_set_updated_at();

CREATE OR REPLACE FUNCTION public.news_settings()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        (SELECT value FROM public.platform_settings WHERE key = 'news_automation'),
        '{}'::jsonb
    );
$$;

CREATE OR REPLACE FUNCTION public.news_setting_int(p_key text, p_default integer)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        NULLIF(public.news_settings() ->> p_key, '')::integer,
        p_default
    );
$$;

CREATE OR REPLACE FUNCTION public.news_setting_bool(p_key text, p_default boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT COALESCE(
        NULLIF(public.news_settings() ->> p_key, '')::boolean,
        p_default
    );
$$;

-- ----------------------------------------------------------------------------
--  8. Réservation d'un élément RSS (anti-doublon par URL)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_claim_item(
    p_url_key text,
    p_title_hash text,
    p_source_id text,
    p_title text,
    p_url text,
    p_published_at timestamptz,
    p_summary text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_id bigint;
BEGIN
    INSERT INTO public.news_seen_items
        (url_key, title_hash, source_id, title, url, published_at, summary)
    VALUES
        (p_url_key, p_title_hash, p_source_id, p_title, p_url, p_published_at, p_summary)
    ON CONFLICT (url_key) DO NOTHING
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
--  9. Verrou de collecte
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_acquire_collection_lock()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_acquired boolean := false;
BEGIN
    UPDATE public.news_collect_lock
       SET locked_at = now()
     WHERE id = 1
       AND (locked_at IS NULL OR locked_at < now() - interval '10 minutes')
    RETURNING true INTO v_acquired;
    RETURN COALESCE(v_acquired, false);
END;
$$;

CREATE OR REPLACE FUNCTION public.news_release_collection_lock()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE public.news_collect_lock SET locked_at = NULL WHERE id = 1;
$$;

-- ----------------------------------------------------------------------------
-- 10. Quota restant pour la journée (UTC)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_remaining_quota()
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT GREATEST(
        public.news_setting_int('daily_limit', 5)
        - (
            SELECT COUNT(*)::integer
            FROM public.articles
            WHERE created_at >= date_trunc('day', now())
              AND status <> 'rejected'
              AND COALESCE(published_by, '') <> 'admin'
        ),
        0
    );
$$;

-- ----------------------------------------------------------------------------
-- 11. Création atomique d'un article en attente de validation
--     (limite quotidienne, doublons de sujet/titre, slug unique, journal)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_create_article(p_payload jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_title          text := btrim(COALESCE(p_payload->>'title', ''));
    v_slug           text := btrim(COALESCE(p_payload->>'slug', ''));
    v_excerpt        text := btrim(COALESCE(p_payload->>'excerpt', ''));
    v_content        text := COALESCE(p_payload->>'content', '');
    v_category       text := COALESCE(p_payload->>'category', 'emploi');
    v_topic_key      text := NULLIF(p_payload->>'topic_key', '');
    v_title_norm     text := NULLIF(p_payload->>'title_normalized', '');
    v_content_hash   text := NULLIF(p_payload->>'content_hash', '');
    v_sources        jsonb := COALESCE(p_payload->'sources', '[]'::jsonb);
    v_source_url     text := NULLIF(p_payload->>'source_url', '');
    v_cover_image    text := NULLIF(p_payload->>'cover_image', '');
    v_ai_model       text := NULLIF(p_payload->>'ai_model', '');
    v_ai_confidence  numeric := NULLIF(p_payload->>'ai_confidence', '')::numeric;
    v_seen_ids       bigint[] := ARRAY[]::bigint[];
    v_review_minutes integer := public.news_setting_int('review_minutes', 15);
    v_auto_publish   boolean := public.news_setting_bool('auto_publish_enabled', true);
    v_daily_limit    integer := public.news_setting_int('daily_limit', 5);
    v_today_count    integer;
    v_slug_try       text;
    v_suffix         integer := 1;
    v_id             uuid;
    v_author         text := COALESCE(NULLIF(p_payload->>'author', ''), 'Rédaction TravaillerEnCi');
BEGIN
    IF length(v_title) < 20 OR length(v_content) < 500 THEN
        RETURN NULL;
    END IF;
    IF jsonb_typeof(v_sources) <> 'array' OR jsonb_array_length(v_sources) < 1 THEN
        RETURN NULL;
    END IF;
    IF v_topic_key IS NULL OR v_content_hash IS NULL THEN
        RETURN NULL;
    END IF;
    IF v_category NOT IN (
        'emploi', 'formation', 'concours', 'economie', 'carriere', 'guide',
        'societe', 'technologie', 'afrique', 'entrepreneuriat', 'opportunites'
    ) THEN
        v_category := 'societe';
    END IF;

    SELECT COUNT(*)::integer
      INTO v_today_count
      FROM public.articles
     WHERE created_at >= date_trunc('day', now())
       AND status <> 'rejected'
       AND COALESCE(published_by, '') <> 'admin';

    IF v_today_count >= v_daily_limit THEN
        RETURN NULL;
    END IF;

    -- Même sujet ou titre très proche dans les 7 derniers jours.
    IF EXISTS (
        SELECT 1 FROM public.articles
         WHERE created_at > now() - interval '7 days'
           AND status <> 'rejected'
           AND (
                (v_topic_key IS NOT NULL AND topic_key = v_topic_key)
             OR (v_title_norm IS NOT NULL AND title_normalized = v_title_norm)
             OR (
                  v_title_norm IS NOT NULL
                  AND title_normalized IS NOT NULL
                  AND similarity(title_normalized, v_title_norm) > 0.45
             )
           )
    ) THEN
        RETURN NULL;
    END IF;

    IF v_slug = '' THEN
        v_slug := lower(regexp_replace(v_title, '[^a-zA-Z0-9]+', '-', 'g'));
        v_slug := btrim(v_slug, '-');
        v_slug := left(v_slug, 90);
    END IF;
    v_slug_try := v_slug;
    WHILE EXISTS (SELECT 1 FROM public.articles WHERE slug = v_slug_try) LOOP
        v_suffix := v_suffix + 1;
        v_slug_try := left(v_slug, 80) || '-' || v_suffix;
        IF v_suffix > 20 THEN
            RETURN NULL;
        END IF;
    END LOOP;

    IF jsonb_typeof(p_payload->'seen_ids') = 'array' THEN
        SELECT COALESCE(array_agg(value::bigint), ARRAY[]::bigint[])
          INTO v_seen_ids
          FROM jsonb_array_elements_text(p_payload->'seen_ids') AS value
         WHERE value ~ '^[0-9]+$';
    END IF;

    INSERT INTO public.articles (
        title, slug, excerpt, content, category, source_url, cover_image,
        author, status, review_deadline, auto_publish, admin_action,
        sources, source_count, topic_key, content_hash, title_normalized,
        ai_model, ai_confidence
    ) VALUES (
        v_title, v_slug_try, v_excerpt, v_content, v_category, v_source_url, v_cover_image,
        v_author, 'pending_review', now() + make_interval(mins => v_review_minutes), v_auto_publish, NULL,
        v_sources, jsonb_array_length(v_sources), v_topic_key, v_content_hash, v_title_norm,
        v_ai_model, v_ai_confidence
    )
    RETURNING id INTO v_id;

    UPDATE public.news_seen_items
       SET used_in_article_id = v_id,
           topic_key = v_topic_key
     WHERE id = ANY(v_seen_ids);

    INSERT INTO public.news_publication_log
        (article_id, article_slug, article_title, action, actor, details)
    VALUES
        (v_id, v_slug_try, v_title, 'created', 'auto',
         jsonb_build_object('auto_publish', v_auto_publish, 'review_minutes', v_review_minutes));

    RETURN v_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 12. Publication automatique après échéance (15 min par défaut)
--     Vérifications : sources autorisées, dates, contenu, doublons, confiance.
--     Opération atomique et idempotente, par lots.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_publish_due_articles(p_limit integer DEFAULT 5)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    rec              record;
    v_enabled        boolean := public.news_setting_bool('enabled', true);
    v_auto_enabled   boolean := public.news_setting_bool('auto_publish_enabled', true);
    v_min_sources    integer := public.news_setting_int('min_sources', 1);
    v_min_content    integer := public.news_setting_int('min_content_chars', 700);
    v_daily_limit    integer := public.news_setting_int('daily_limit', 5);
    v_remaining      integer;
    v_published      integer := 0;
    v_blocked        integer := 0;
    v_slugs          jsonb := '[]'::jsonb;
    v_error          text;
    v_checks         jsonb;
BEGIN
    IF NOT v_enabled OR NOT v_auto_enabled THEN
        RETURN jsonb_build_object('published', 0, 'blocked', 0, 'reason', 'automatisation désactivée');
    END IF;

    SELECT GREATEST(
        v_daily_limit - (
            SELECT COUNT(*)::integer
              FROM public.articles
             WHERE status = 'published'
               AND published_by = 'auto'
               AND published_at >= date_trunc('day', now())
        ),
        0
    ) INTO v_remaining;

    IF v_remaining <= 0 THEN
        RETURN jsonb_build_object('published', 0, 'blocked', 0, 'reason', 'quota quotidien atteint');
    END IF;

    FOR rec IN
        SELECT *
          FROM public.articles
         WHERE status = 'pending_review'
           AND auto_publish = true
           AND (admin_action IS NULL OR admin_action = 'edited')
           AND review_deadline IS NOT NULL
           AND review_deadline <= now()
         ORDER BY review_deadline ASC
         LIMIT LEAST(GREATEST(p_limit, 1), v_remaining)
         FOR UPDATE SKIP LOCKED
    LOOP
        v_error := NULL;
        v_checks := jsonb_build_object('checked_at', now());

        BEGIN
            IF rec.source_count < v_min_sources THEN
                v_error := format('Sources insuffisantes (%s/%s).', rec.source_count, v_min_sources);
            ELSIF NOT EXISTS (
                SELECT 1
                  FROM jsonb_array_elements(COALESCE(rec.sources, '[]'::jsonb)) AS s
                  JOIN public.news_sources AS ns
                    ON ns.id = (s ->> 'source_id')
                 WHERE ns.enabled = true
                   AND ns.allowed_for_citation = true
            ) THEN
                v_error := 'Aucune source autorisée à la citation.';
            ELSIF length(btrim(COALESCE(rec.title, ''))) < 20 THEN
                v_error := 'Titre trop court.';
            ELSIF length(btrim(COALESCE(rec.excerpt, ''))) < 40 THEN
                v_error := 'Résumé trop court.';
            ELSIF length(COALESCE(rec.content, '')) < v_min_content THEN
                v_error := format('Contenu trop court (%s caractères, minimum %s).',
                                  length(COALESCE(rec.content, '')), v_min_content);
            ELSIF rec.ai_confidence IS NOT NULL AND rec.ai_confidence < 0.550 THEN
                v_error := format('Confiance IA insuffisante (%s).', rec.ai_confidence);
            ELSIF EXISTS (
                SELECT 1
                  FROM jsonb_array_elements(COALESCE(rec.sources, '[]'::jsonb)) AS s
                 WHERE (s ->> 'published_at') IS NOT NULL
                   AND (s ->> 'published_at')::timestamptz > now() + interval '1 hour'
            ) THEN
                v_error := 'Date de source incohérente (future).';
            ELSIF NOT EXISTS (
                SELECT 1
                  FROM jsonb_array_elements(COALESCE(rec.sources, '[]'::jsonb)) AS s
                 WHERE (s ->> 'published_at') IS NOT NULL
                   AND (s ->> 'published_at')::timestamptz >= now() - interval '7 days'
            ) THEN
                v_error := 'Sources trop anciennes.';
            ELSIF rec.content_hash IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.articles
                 WHERE id <> rec.id
                   AND status = 'published'
                   AND content_hash = rec.content_hash
                   AND published_at >= now() - interval '30 days'
            ) THEN
                v_error := 'Doublon de contenu avec un article publié.';
            ELSIF rec.title_normalized IS NOT NULL AND EXISTS (
                SELECT 1 FROM public.articles
                 WHERE id <> rec.id
                   AND status = 'published'
                   AND title_normalized = rec.title_normalized
                   AND published_at >= now() - interval '7 days'
            ) THEN
                v_error := 'Doublon de titre avec un article publié.';
            END IF;

            IF v_error IS NULL THEN
                UPDATE public.articles
                   SET status = 'published',
                       published_at = now(),
                       published_by = 'auto',
                       admin_action = 'auto_published',
                       admin_action_at = now(),
                       validation_error = NULL,
                       validation_checks = jsonb_build_object(
                           'checked_at', now(),
                           'sources_ok', true,
                           'dates_ok', true,
                           'content_ok', true,
                           'duplicates_ok', true
                       ),
                       updated_at = now()
                 WHERE id = rec.id;

                INSERT INTO public.news_publication_log
                    (article_id, article_slug, article_title, action, actor, details)
                VALUES
                    (rec.id, rec.slug, rec.title, 'auto_published', 'auto',
                     jsonb_build_object('published_at', now()));

                v_published := v_published + 1;
                v_slugs := v_slugs || to_jsonb(rec.slug);
            ELSE
                UPDATE public.articles
                   SET auto_publish = false,
                       admin_action = 'auto_blocked',
                       admin_action_at = now(),
                       validation_error = v_error,
                       validation_checks = COALESCE(v_checks, '{}'::jsonb) || jsonb_build_object('error', v_error),
                       updated_at = now()
                 WHERE id = rec.id;

                INSERT INTO public.news_publication_log
                    (article_id, article_slug, article_title, action, actor, reason, details)
                VALUES
                    (rec.id, rec.slug, rec.title, 'auto_publish_blocked', 'auto', v_error,
                     COALESCE(v_checks, '{}'::jsonb));

                v_blocked := v_blocked + 1;
            END IF;
        EXCEPTION WHEN OTHERS THEN
            v_error := 'Erreur de validation : ' || SQLERRM;
            UPDATE public.articles
               SET auto_publish = false,
                   admin_action = 'auto_blocked',
                   admin_action_at = now(),
                   validation_error = left(v_error, 500),
                   updated_at = now()
             WHERE id = rec.id;

            INSERT INTO public.news_publication_log
                (article_id, article_slug, article_title, action, actor, reason)
            VALUES
                (rec.id, rec.slug, rec.title, 'auto_publish_blocked', 'auto', left(v_error, 500));

            v_blocked := v_blocked + 1;
        END;
    END LOOP;

    RETURN jsonb_build_object(
        'published', v_published,
        'blocked', v_blocked,
        'slugs', v_slugs
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 13. Purge et politique de conservation
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_purge_expired(p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_pending_hours      integer := public.news_setting_int('pending_max_hours', 24);
    v_rejected_days      integer := public.news_setting_int('rejected_retention_days', 7);
    v_manual_rejected    integer := public.news_setting_int('manual_rejected_retention_days', 30);
    v_recent_days        integer := public.news_setting_int('published_recent_days', 30);
    v_archived_days      integer := public.news_setting_int('archived_retention_days', 90);
    v_manual_archived    integer := public.news_setting_int('manual_archived_retention_days', 180);
    v_seen_days          integer := public.news_setting_int('seen_retention_days', 30);
    v_expired_pending    integer := 0;
    v_archived           integer := 0;
    v_deleted_rejected   integer := 0;
    v_deleted_archived   integer := 0;
    v_deleted_seen       integer := 0;
    v_deleted_runs       integer := 0;
    v_deleted_logs       integer := 0;
BEGIN
    IF p_dry_run THEN
        SELECT COUNT(*) INTO v_expired_pending FROM public.articles
         WHERE status = 'pending_review' AND created_at < now() - make_interval(hours => v_pending_hours);
        SELECT COUNT(*) INTO v_archived FROM public.articles
         WHERE status = 'published' AND published_at < now() - make_interval(days => v_recent_days);
        SELECT COUNT(*) INTO v_deleted_rejected FROM public.articles
         WHERE status = 'rejected' AND created_at < now() - make_interval(days => v_rejected_days);
        SELECT COUNT(*) INTO v_deleted_archived FROM public.articles
         WHERE status = 'archived'
           AND archived_at < now() - make_interval(days =>
               CASE WHEN manually_edited THEN v_manual_archived ELSE v_archived_days END);
        RETURN jsonb_build_object(
            'dry_run', true,
            'pending_to_expire', v_expired_pending,
            'to_archive', v_archived,
            'rejected_to_delete', v_deleted_rejected,
            'archived_to_delete', v_deleted_archived
        );
    END IF;

    -- 24 h : un article non traité n'est jamais publié, il passe en rejeté.
    UPDATE public.articles
       SET status = 'rejected',
           auto_publish = false,
           admin_action = 'system_expired',
           admin_action_at = now(),
           rejection_reason = 'Délai de validation dépassé (24 h).',
           updated_at = now()
     WHERE status = 'pending_review'
       AND created_at < now() - make_interval(hours => v_pending_hours);
    GET DIAGNOSTICS v_expired_pending = ROW_COUNT;

    -- 30 jours : retrait des actualités récentes, URL conservée.
    UPDATE public.articles
       SET status = 'archived',
           archived_at = now(),
           updated_at = now()
     WHERE status = 'published'
       AND published_at < now() - make_interval(days => v_recent_days);
    GET DIAGNOSTICS v_archived = ROW_COUNT;

    -- Rejetés : 7 jours (30 jours si modifiés manuellement).
    INSERT INTO public.news_publication_log
        (article_id, article_slug, article_title, action, actor, reason)
    SELECT id, slug, title, 'purged', 'system', 'Rétention des articles rejetés dépassée.'
      FROM public.articles
     WHERE status = 'rejected'
       AND created_at < now() - make_interval(days =>
           CASE WHEN manually_edited THEN v_manual_rejected ELSE v_rejected_days END);

    DELETE FROM public.articles
     WHERE status = 'rejected'
       AND created_at < now() - make_interval(days =>
           CASE WHEN manually_edited THEN v_manual_rejected ELSE v_rejected_days END);
    GET DIAGNOSTICS v_deleted_rejected = ROW_COUNT;

    -- Archivés : 90 jours (180 jours si modifiés manuellement).
    INSERT INTO public.news_publication_log
        (article_id, article_slug, article_title, action, actor, reason)
    SELECT id, slug, title, 'purged', 'system', 'Rétention des articles archivés dépassée.'
      FROM public.articles
     WHERE status = 'archived'
       AND archived_at < now() - make_interval(days =>
           CASE WHEN manually_edited THEN v_manual_archived ELSE v_archived_days END);

    DELETE FROM public.articles
     WHERE status = 'archived'
       AND archived_at < now() - make_interval(days =>
           CASE WHEN manually_edited THEN v_manual_archived ELSE v_archived_days END);
    GET DIAGNOSTICS v_deleted_archived = ROW_COUNT;

    -- Éléments RSS vus : 30 jours s'ils n'ont pas servi, 180 jours sinon.
    DELETE FROM public.news_seen_items
     WHERE (used_in_article_id IS NULL AND first_seen_at < now() - make_interval(days => v_seen_days))
        OR (used_in_article_id IS NOT NULL AND first_seen_at < now() - interval '180 days');
    GET DIAGNOSTICS v_deleted_seen = ROW_COUNT;

    DELETE FROM public.news_pipeline_runs
     WHERE started_at < now() - interval '30 days';
    GET DIAGNOSTICS v_deleted_runs = ROW_COUNT;

    DELETE FROM public.news_publication_log
     WHERE created_at < now() - interval '180 days';
    GET DIAGNOSTICS v_deleted_logs = ROW_COUNT;

    RETURN jsonb_build_object(
        'dry_run', false,
        'pending_expired', v_expired_pending,
        'archived', v_archived,
        'rejected_deleted', v_deleted_rejected,
        'archived_deleted', v_deleted_archived,
        'seen_deleted', v_deleted_seen,
        'runs_deleted', v_deleted_runs,
        'logs_deleted', v_deleted_logs
    );
END;
$$;

-- ----------------------------------------------------------------------------
-- 14. Faut-il lancer une collecte ? (léger, indexé, appelé par pg_cron)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_should_collect()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    v_enabled     boolean := public.news_setting_bool('enabled', true);
    v_interval    integer := public.news_setting_int('collect_interval_hours', 3);
    v_last_run    timestamptz;
    v_sources     integer;
    v_quota       integer;
BEGIN
    IF NOT v_enabled THEN
        RETURN jsonb_build_object('should', false, 'reason', 'automatisation désactivée');
    END IF;

    SELECT COUNT(*)::integer INTO v_sources
      FROM public.news_sources WHERE enabled = true;
    IF v_sources = 0 THEN
        RETURN jsonb_build_object('should', false, 'reason', 'aucune source activée');
    END IF;

    SELECT MAX(started_at) INTO v_last_run
      FROM public.news_pipeline_runs
     WHERE status IN ('success', 'partial', 'skipped');

    IF v_last_run IS NOT NULL
       AND v_last_run > now() - make_interval(hours => v_interval) THEN
        RETURN jsonb_build_object('should', false, 'reason', 'intervalle non écoulé', 'last_run', v_last_run);
    END IF;

    v_quota := public.news_remaining_quota();
    IF v_quota <= 0 THEN
        RETURN jsonb_build_object('should', false, 'reason', 'quota quotidien atteint');
    END IF;

    RETURN jsonb_build_object('should', true, 'remaining_quota', v_quota);
END;
$$;

-- ----------------------------------------------------------------------------
-- 15. Déclenchement de la collecte via pg_net (secret lu dans Vault)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_trigger_collection()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_should      jsonb := public.news_should_collect();
    v_url         text := COALESCE(
        NULLIF(public.news_settings() ->> 'collector_url', ''),
        'https://travaillerenci.vercel.app/api/news/collect'
    );
    v_secret      text;
    v_request_id  bigint;
BEGIN
    IF COALESCE((v_should ->> 'should')::boolean, false) IS NOT TRUE THEN
        RETURN NULL;
    END IF;

    SELECT decrypted_secret
      INTO v_secret
      FROM vault.decrypted_secrets
     WHERE name = 'news_pipeline_secret'
     LIMIT 1;

    IF v_secret IS NULL OR btrim(v_secret) = '' THEN
        RAISE NOTICE 'news_pipeline_secret absent de Vault : collecte ignorée.';
        RETURN NULL;
    END IF;

    SELECT net.http_post(
        url := v_url,
        body := jsonb_build_object('trigger', 'pg_cron'),
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_secret
        ),
        timeout_milliseconds := 55000
    ) INTO v_request_id;

    RETURN v_request_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 16. Compteur de vues public (une seule requête légère)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_increment_view(p_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    UPDATE public.articles
       SET view_count = view_count + 1
     WHERE slug = p_slug
       AND status IN ('published', 'archived');
$$;

-- ----------------------------------------------------------------------------
-- 17. Vérification légère avant appel IA : le sujet a-t-il déjà été traité ?
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_topic_exists(p_title_normalized text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
          FROM public.articles
         WHERE created_at > now() - interval '7 days'
           AND status <> 'rejected'
           AND title_normalized IS NOT NULL
           AND (
                title_normalized = p_title_normalized
                OR similarity(title_normalized, p_title_normalized) > 0.45
           )
    );
$$;

-- ----------------------------------------------------------------------------
-- 18. Statistiques compactes pour le dashboard admin (une seule requête)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.news_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT jsonb_build_object(
        'pending', (SELECT COUNT(*)::integer FROM public.articles WHERE status = 'pending_review'),
        'published', (SELECT COUNT(*)::integer FROM public.articles WHERE status = 'published'),
        'archived', (SELECT COUNT(*)::integer FROM public.articles WHERE status = 'archived'),
        'rejected', (SELECT COUNT(*)::integer FROM public.articles WHERE status = 'rejected'),
        'draft', (SELECT COUNT(*)::integer FROM public.articles WHERE status = 'draft'),
        'publishedToday', (
            SELECT COUNT(*)::integer FROM public.articles
             WHERE status = 'published' AND published_at >= date_trunc('day', now())
        ),
        'aiCallsToday', (
            SELECT COALESCE(SUM(ai_calls), 0)::integer FROM public.news_pipeline_runs
             WHERE started_at >= date_trunc('day', now())
        ),
        'totalViews', (SELECT COALESCE(SUM(view_count), 0)::integer FROM public.articles),
        'lastRun', (
            SELECT to_jsonb(r) FROM public.news_pipeline_runs r
             ORDER BY started_at DESC LIMIT 1
        )
    );
$$;

-- ----------------------------------------------------------------------------
-- 19. Droits
-- ----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.news_claim_item(text, text, text, text, text, timestamptz, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.news_acquire_collection_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.news_release_collection_lock() TO service_role;
GRANT EXECUTE ON FUNCTION public.news_remaining_quota() TO service_role;
GRANT EXECUTE ON FUNCTION public.news_create_article(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.news_publish_due_articles(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.news_purge_expired(boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.news_should_collect() TO service_role;
GRANT EXECUTE ON FUNCTION public.news_trigger_collection() TO service_role;
GRANT EXECUTE ON FUNCTION public.news_topic_exists(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.news_stats() TO service_role;
GRANT EXECUTE ON FUNCTION public.news_increment_view(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.news_settings() TO anon, authenticated, service_role;

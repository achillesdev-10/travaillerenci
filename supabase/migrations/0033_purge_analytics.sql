-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0033
--  Description : purge automatique des tables qui grossissent sans borne.
--
--  Problème : chaque page vue insère une ligne dans `site_visits` et les
--  parcours utilisateurs insèrent des lignes dans `analytics_events`. Sans
--  purge, la base du plan gratuit (500 Mo) se remplit.
--
--  Solution :
--    1) table d'agrégats `site_visits_daily` — (jour, source, nb de visites) ;
--    2) fonction `purge_analytics()` :
--         • agrège dans `site_visits_daily` les visites de plus de 90 jours,
--         • supprime ces lignes de `site_visits`,
--         • supprime les `analytics_events` de plus de 180 jours ;
--    3) planification quotidienne via pg_cron (04:15 UTC).
--
--  Les mesures < 90 jours restent ligne par ligne (pages /admin/analytics et
--  dashboard lisent des fenêtres ≤ 14 jours) : aucun graphique ne change.
--  Le total des visites = somme des agrégats + lignes restantes (adapté côté
--  Next.js dans src/lib/admin-dashboard.ts).
--
--  PRESSION SUR LES 500 Mo :
--    • site_visits_daily : 1 ligne par (jour, source) — ~365 lignes/an et
--      par source distincte, négligeable devant les visites ligne à ligne.
--
--  À APPLIQUER (idempotent : peut être relancé sans risque) :
--    Supabase Dashboard > SQL Editor : coller tout le script puis Run.
--    ⚠️ PRÉ-REQUIS MANUEL : activer l'extension pg_cron — Database →
--    Extensions → pg_cron (Toggle ON) — puis lancer ce script. Si pg_cron
--    n'est pas encore active, le script s'exécute quand même (tables +
--    fonction) mais affiche un NOTICE et SAUTE la planification : relancer
--    le script ensuite.
--  Pour tester la fonction à la main :
--    SELECT public.purge_analytics();  → colonnes (visits_aggregated, visits_deleted, events_deleted)
--
--  ANNULER (rollback) :
--    SELECT cron.unschedule('purge-analytics');
--    DROP FUNCTION IF EXISTS public.purge_analytics();
--    DROP TABLE IF EXISTS public.site_visits_daily;
--    (Les visites agrégées avant le rollback ne sont PAS recrées ligne par
--    ligne : restaurer un backup si nécessaire.)
-- ============================================================================

-- ---------------------------------------------------------------------------
--  Index sur created_at : déjà créés par les migrations 0006 et 0027 ; on les
--  ré-assert ici (idempotent) car c'est leur existence qui rend la purge sûre.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_site_visits_created_at
    ON public.site_visits (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created
    ON public.analytics_events (created_at DESC);

-- ---------------------------------------------------------------------------
--  Table d'agrégats `site_visits_daily`
--  RLS activée + politiques de refus total (même modèle que site_visits :
--  table serveur uniquement, les clients anon/authenticated ne voient rien ;
--  le service_role Supabase et pg_cron contournent la RLS).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_visits_daily (
    day      DATE   NOT NULL,
    source   TEXT   NOT NULL DEFAULT 'direct',
    visits   BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (day, source)
);

COMMENT ON TABLE  public.site_visits_daily
    IS 'Agrégats de visites (> 90 jours) : une ligne par (jour, source). Alimentée par purge_analytics().';
COMMENT ON COLUMN public.site_visits_daily.source
    IS 'Source de trafic normalisée (site_visits.source ; NULL agrégé en ''direct'').';
COMMENT ON COLUMN public.site_visits_daily.visits
    IS 'Nombre total de visites ce jour-là pour cette source.';

ALTER TABLE public.site_visits_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "site_visits_daily lecture service_role" ON public.site_visits_daily;
CREATE POLICY "site_visits_daily lecture service_role"
    ON public.site_visits_daily FOR SELECT
    USING (FALSE);

DROP POLICY IF EXISTS "site_visits_daily insertion service_role" ON public.site_visits_daily;
CREATE POLICY "site_visits_daily insertion service_role"
    ON public.site_visits_daily FOR INSERT
    WITH CHECK (FALSE);

DROP POLICY IF EXISTS "site_visits_daily maj service_role" ON public.site_visits_daily;
CREATE POLICY "site_visits_daily maj service_role"
    ON public.site_visits_daily FOR UPDATE
    USING (FALSE);

DROP POLICY IF EXISTS "site_visits_daily suppression service_role" ON public.site_visits_daily;
CREATE POLICY "site_visits_daily suppression service_role"
    ON public.site_visits_daily FOR DELETE
    USING (FALSE);

-- ---------------------------------------------------------------------------
--  Fonction `purge_analytics()`
--  Traite la base par lots de 5000 lignes : chaque lot est agrégé puis
--  supprimé avant le suivant, pour ne pas saturer une transaction sur une
--  base déjà grosse. Retourne les compteurs traités (à des fins de journal).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.purge_analytics()
RETURNS TABLE (visits_aggregated BIGINT, visits_deleted BIGINT, events_deleted BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff_visits TIMESTAMPTZ := now() - interval '90 days';
    v_cutoff_events TIMESTAMPTZ := now() - interval '180 days';
    v_batch_size    INTEGER := 5000;
    v_loop_rows     BIGINT;
BEGIN
    -- Les paramètres OUT d'une fonction RETURNS TABLE commencent à NULL :
    -- sans initialisation, `NULL + n` resterait NULL et la fonction retournerait
    -- des compteurs NULL au lieu de 0. Testé le 2026-10-28.
    visits_aggregated := 0;
    visits_deleted := 0;
    events_deleted := 0;

    -- (1) Visites : agrège puis supprime, lot par lot.
    LOOP
        -- Agrégation du lot (> 90 jours), fusion avec d'éventuelles valeurs
        -- précédentes ; NULL source agrégé en 'direct' (convention 0031).
        INSERT INTO public.site_visits_daily (day, source, visits)
        SELECT created_at::date AS day,
               COALESCE(source, 'direct') AS source,
               COUNT(*)::bigint
        FROM (
            SELECT created_at, source
            FROM public.site_visits
            WHERE created_at < v_cutoff_visits
            LIMIT v_batch_size
        ) batch
        GROUP BY 1, 2
        ON CONFLICT (day, source) DO UPDATE
            SET visits = public.site_visits_daily.visits + EXCLUDED.visits;

        -- Suppression du lot fraîchement agrégé, avec le MÊME critère
        -- (90 jours). Les deux opérations sont séparées par un instant :
        -- toute nouvelle ligne a created_at = now() donc ne matche jamais
        -- le critère — pas de comptage en double possible.
        DELETE FROM public.site_visits
        WHERE id IN (
            SELECT id
            FROM public.site_visits
            WHERE created_at < v_cutoff_visits
            LIMIT v_batch_size
        );

        GET DIAGNOSTICS v_loop_rows = ROW_COUNT;
        visits_deleted := visits_deleted + v_loop_rows;

        EXIT WHEN v_loop_rows = 0;
    END LOOP;

    -- Les lignes supprimées sont exactement celles agrégées (mêmes critères,
    -- exécutés d'affilée sur le même parc de lignes) : un seul compteur.
    visits_aggregated := visits_deleted;

    -- (2) Événements produits : suppression simple par lots (> 180 jours).
    LOOP
        DELETE FROM public.analytics_events
        WHERE id IN (
            SELECT id
            FROM public.analytics_events
            WHERE created_at < v_cutoff_events
            LIMIT v_batch_size
        );

        GET DIAGNOSTICS v_loop_rows = ROW_COUNT;
        events_deleted := events_deleted + v_loop_rows;
        EXIT WHEN v_loop_rows < v_batch_size;
    END LOOP;

    RETURN QUERY SELECT visits_aggregated, visits_deleted, events_deleted;
END;
$$;

COMMENT ON FUNCTION public.purge_analytics()
    IS 'Agrège les visites > 90 jours dans site_visits_daily puis les supprime de site_visits ; supprime analytics_events > 180 jours (lots de 5000).';

-- La fonction tourne en service interne : son appel depuis PostgREST est
-- interdit aux clients. ⚠️ PostgreSQL accorde EXECUTE au rôle PUBLIC par
-- défaut, dont anon et authenticated héritent : il faut révoquer PUBLIC
-- aussi, sinon la fonction reste appelable par tout le monde via RPC.
REVOKE ALL ON FUNCTION public.purge_analytics() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.purge_analytics() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_analytics() TO service_role;

-- ---------------------------------------------------------------------------
--  Planification quotidienne via pg_cron (04:15 UTC, après le pic de trafic).
--  Idempotent : dé-planifie puis re-planifie, le nom du job est stable.
--  ⚠️ pg_cron doit d'abord être activée à la main : Database → Extensions →
--  pg_cron (Toggle ON). Sans elle, le script se termine quand même (tables +
--  fonction créées) et se contente d'un NOTICE : relancer le script ensuite.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'cron') THEN
        -- Dé-planifie l'ancien job (idempotence : évite tout doublon).
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-analytics') THEN
            PERFORM cron.unschedule('purge-analytics');
        END IF;
        PERFORM cron.schedule(
            'purge-analytics',
            '15 4 * * *',
            'SELECT public.purge_analytics()'
        );
    ELSE
        RAISE NOTICE 'pg_cron non active : planification sautée. Activez-la (Database > Extensions) puis relancez ce script pour programmer le passage quotidien.';
    END IF;
END $$;

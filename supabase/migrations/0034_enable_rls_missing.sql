-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0034
--  Description : durcissement RLS après audit complet (tâche C de la mission
--  « sauvegardes / purge / sécurité »), appliqué le 2026-10-28.
--
--  AUDIT RÉALISÉ (prod réelle, requêtes pg_catalog via API Management) :
--    • 23 tables publiques existantes : TOUTES ont déjà RLS activé ✓ ;
--    • politiques cohérentes : refus total (USING/WITH CHECK false) sur toutes
--      les tables sensibles (users, candidate_profiles, alerts, reports,
--      newsletter_subscribers, tokens, analytics, visites…), lecture publique
--      uniquement où voulue (job_offers, exams, blog_posts publiés, profils) ;
--    • DEUX écarts réels corrigés ci-dessous (scraper_logs lisible publiquement
--      et fonction SECURITY DEFINER appelable par anon) ;
--    • tables du repo ABSENTES de la prod (migrations jamais appliquées) :
--      notifications (0020), entreprendre_* (0021), platform_settings (0023),
--      admin_notifications (0024) — les services Next.js retombent silencieusement
--      sur des valeurs par défaut. Rien à corriger tant qu'elles n'existent pas :
--      le garde-fou §3 ci-dessous s'activera automatiquement le jour où elles
--      seront créées (l'event trigger `rls_auto_enable` active déjà la RLS sur
--      toute nouvelle table, mais sans politique — ce bloc ajoute le refus total).
--
--  À APPLIQUER (idempotent) : Supabase Dashboard > SQL Editor > Run.
--  ROLLBACK : voir commentaires de chaque section.
-- ============================================================================

-- ---------------------------------------------------------------------------
--  1) scraper_logs : la politique « Lecture scraper_logs » (USING true, posée
--     par 0004) rendait les journaux du scraper lisibles par tout visiteur via
--     PostgREST (messages d'erreur internes, volumes, sites sourcés…).
--     Les lectures légitimes passent par le serveur (service_role, qui
--     contourne la RLS) : le refus total pour anon/authenticated ne change
--     rien pour l'application.
--  ROLLBACK : DROP POLICY "scraper_logs lecture refus total (0034)" … ;
--             CREATE POLICY "Lecture scraper_logs" … USING (true) ;
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Lecture scraper_logs" ON public.scraper_logs;
DROP POLICY IF EXISTS "scraper_logs lecture refus total (0034)" ON public.scraper_logs;
CREATE POLICY "scraper_logs lecture refus total (0034)"
    ON public.scraper_logs FOR SELECT
    USING (FALSE);

-- ---------------------------------------------------------------------------
--  2) increment_exam_views(uuid/text) : SECURITY DEFINER (owner postgres) qui
--     fait un UPDATE sur exams. PostgreSQL accorde EXECUTE au rôle PUBLIC par
--     défaut → tout visiteur pouvait l'appeler via /rest/v1/rpc/… et gonfler
--     les compteurs à volonté. L'app légitime l'appelle côté serveur avec
--     service_role : on réserve l'exécution à ce rôle.
--  ROLLBACK : GRANT EXECUTE … TO PUBLIC (état d'origine par défaut).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    f OID;
BEGIN
    SELECT p.oid INTO f
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'increment_exam_views'
    LIMIT 1;

    IF f IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f::regprocedure);
        EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon, authenticated', f::regprocedure);
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f::regprocedure);
        RAISE NOTICE 'increment_exam_views : exécution réservée à service_role.';
    ELSE
        RAISE NOTICE 'increment_exam_views introuvable : section sautée.';
    END IF;
END $$;

-- ---------------------------------------------------------------------------
--  3) Garde-fou pour les tables du repo encore absentes de la prod
--     (0020/0021/0023/0024) : si elles existent (autre environnement, ou
--     application future des migrations), on force RLS + refus total, mais
--     UNIQUEMENT si elles n'ont AUCUNE politique — on n'écrase jamais les
--     politiques voulues (ex. lectures publiques de 0021).
--     Idempotent : table absente ou déjà pourvue → no-op silencieux.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
    tbl  TEXT;
    t    REGCLASS;
    candidats TEXT[] := ARRAY[
        'platform_settings',
        'admin_notifications',
        'notifications',
        'entreprendre_articles',
        'entreprendre_comments'
    ];
BEGIN
    FOREACH tbl IN ARRAY candidats LOOP
        t := to_regclass(format('public.%I', tbl));
        IF t IS NOT NULL THEN
            EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', t);
            IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = t) THEN
                EXECUTE format(
                    'CREATE POLICY %I ON %s FOR SELECT USING (false)',
                    tbl || ' refus total (audit 0034)', t);
                EXECUTE format(
                    'CREATE POLICY %I ON %s FOR INSERT WITH CHECK (false)',
                    tbl || ' insertion refus total (audit 0034)', t);
                EXECUTE format(
                    'CREATE POLICY %I ON %s FOR UPDATE USING (false)',
                    tbl || ' maj refus total (audit 0034)', t);
                EXECUTE format(
                    'CREATE POLICY %I ON %s FOR DELETE USING (false)',
                    tbl || ' suppression refus total (audit 0034)', t);
                RAISE NOTICE '% : RLS + refus total ajoutés (aucune politique préexistante).', tbl;
            END IF;
        END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
--  4) Vérification post-application (à coller séparément si besoin) :
--    SELECT tablename, policyname FROM pg_policies
--      WHERE schemaname='public' AND tablename='scraper_logs';
--    SELECT has_function_privilege('anon','public.increment_exam_views(uuid)','EXECUTE') AS anon_peut_executer;  -- false
--  (le type de l'argument peut varier : uuid ou text selon l'instance —
--   la requête ci-dessous liste la signature exacte :)
--    SELECT p.oid::regprocedure FROM pg_proc p
--      JOIN pg_namespace n ON n.oid=p.pronamespace
--      WHERE n.nspname='public' AND p.proname='increment_exam_views';
-- ============================================================================

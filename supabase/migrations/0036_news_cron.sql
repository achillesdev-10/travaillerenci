-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0036
--  Description : tâches planifiées du système d'actualités (pg_cron + pg_net).
--
--  Répartition volontairement minimale (plan gratuit) :
--    • collecte RSS + rédaction IA   : toutes les 3 heures (configurable)
--    • publication des échéances     : toutes les minutes (SQL pur, sans HTTP)
--    • purge / conservation          : une fois par jour
--
--  La collecte n'appelle Vercel QUE si news_should_collect() répond true.
--  Le secret partagé est lu dans Supabase Vault (jamais stocké en clair ici).
--
--  AVANT D'EXÉCUTER :
--    1. Activer pg_cron et pg_net (Dashboard → Database → Extensions).
--    2. Créer le secret partagé, identique à NEWS_PIPELINE_SECRET sur Vercel :
--         SELECT vault.create_secret(
--           'REMPLACER_PAR_LE_SECRET',
--           'news_pipeline_secret',
--           'Jeton Bearer du pipeline actualités'
--         );
--    3. Vérifier l'URL de collecte dans platform_settings (clé news_automation,
--       champ collector_url) si le domaine change.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ----------------------------------------------------------------------------
--  Remplacement idempotent des tâches existantes
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    j record;
BEGIN
    FOR j IN
        SELECT jobid
          FROM cron.job
         WHERE jobname IN ('news-collect', 'news-publish-tick', 'news-purge-daily')
    LOOP
        PERFORM cron.unschedule(j.jobid);
    END LOOP;
END $$;

-- Collecte toutes les 3 heures (00:05, 03:05, 06:05…).
-- La fonction vérifie elle-même l'intervalle, le quota et le verrou.
SELECT cron.schedule(
    'news-collect',
    '5 */3 * * *',
    $$SELECT public.news_trigger_collection();$$
);

-- Vérification des articles arrivés à échéance : requête SQL indexée,
-- aucune fonction Edge/Vercel réveillée.
SELECT cron.schedule(
    'news-publish-tick',
    '* * * * *',
    $$SELECT public.news_publish_due_articles(5);$$
);

-- Purge et archivage quotidiens (03:20 UTC).
SELECT cron.schedule(
    'news-purge-daily',
    '20 3 * * *',
    $$SELECT public.news_purge_expired(false);$$
);

COMMENT ON FUNCTION public.news_trigger_collection() IS
    'Déclenche la collecte RSS sur Vercel via pg_net si nécessaire (secret Vault).';
COMMENT ON FUNCTION public.news_publish_due_articles(integer) IS
    'Publie atomiquement les articles dont le délai de validation est échu et qui passent tous les contrôles.';
COMMENT ON FUNCTION public.news_purge_expired(boolean) IS
    'Applique la politique de conservation : rejet 24 h, purge rejetés 7 j, archivage 30 j, purge 90/180 j.';

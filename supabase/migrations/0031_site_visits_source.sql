-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0031
--  Description : colonne `source` de `site_visits` (master prompt §23
--  « Sources de trafic »).
--
--  Valeur normalisée par src/lib/trafficSource.ts :
--    • utm_source de la première visite, sinon
--    • domaine d'origine (document.referrer) sans www., sinon
--    • 'direct'  — arrivée sans referer ni UTM
--    • 'interne' — navigation provenant du même domaine
--
--  Aucune donnée existante n'est modifiée ni supprimée ; les visites déjà
--  enregistrées conservent une valeur NULL (= source inconnue, affichée en
--  « direct » côté tableau de bord).
-- ============================================================================

ALTER TABLE public.site_visits
    ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_site_visits_source
    ON public.site_visits (source);

COMMENT ON COLUMN public.site_visits.source
    IS 'Source de trafic normalisée : utm_source, domaine d''origine, ''direct'' ou ''interne''. NULL = visite antérieure à la migration.';

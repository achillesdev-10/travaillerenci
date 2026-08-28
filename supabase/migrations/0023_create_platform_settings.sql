-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0023
--  Description : table `platform_settings` pour les réglages centralisés
--  (taxonomies, scraper, notifications).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
    key         text PRIMARY KEY,
    value       jsonb NOT NULL DEFAULT '{}',
    updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.platform_settings
    IS 'Réglages centralisés de la plateforme (taxonomies, scraper, notifications).';

-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0025
--  Description : ajoute la colonne `sector` (métier / domaine) à job_offers.
--
--  Objectif : catégoriser les offres par métier pour alimenter les pages SEO
--  (/emplois-informatique, /emplois-comptabilite-abidjan…) et améliorer la
--  pertinence des recommandations candidat.
--
--  Valeurs attendues : slugs de `SECTORS` (src/lib/constants.ts), p. ex.
--    it-digital, banque-finance, btp-immobilier, industrie,
--    commerce-distribution, sante, education-formation, agroalimentaire,
--    telecoms, transport-logistique, tourisme-hotellerie,
--    audiovisuel-medias, audit-conseil, juridique, rh, marketing-communication
--
--  NULL = non classé (repli par mots-clés côté application). Aucune donnée
--  existante n'est supprimée ni modifiée ; la colonne est simplement ajoutée.
-- ============================================================================

ALTER TABLE public.job_offers
    ADD COLUMN IF NOT EXISTS sector TEXT;

CREATE INDEX IF NOT EXISTS idx_job_offers_sector
    ON public.job_offers (sector);

COMMENT ON COLUMN public.job_offers.sector
    IS 'Slug de métier/domaine (SECTORS de src/lib/constants.ts). NULL = non classé.';

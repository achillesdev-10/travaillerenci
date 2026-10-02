-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0032
--  Description : champs de statut préparant la future monétisation
--  (master prompt §29) — SANS aucun paiement ni affichage commercial.
--
--  §29 : « NE PAS implémenter la monétisation maintenant. Mais construire une
--  architecture qui permettra plus tard : CV mis en avant, offres mises en
--  avant, profils Premium… Prévoir éventuellement des champs de statut ou de
--  visibilité, mais ne pas afficher de boutons de paiement inutiles. »
--
--  Champs posés :
--    • job_offers.is_featured / featured_until → offre « mise en avant »
--      (null = aucune) — permettra une mise en avant temporaire payante ;
--    • candidate_profiles.plan                → 'free' par défaut, 'premium'
--      réservé à une future offre.
--
--  Aucune donnée existante n'est modifiée ni supprimée, aucun bouton de
--  paiement n'est exposé : seuls les champs sont créés, à valeur neutre.
-- ============================================================================

ALTER TABLE public.job_offers
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.job_offers
    ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_job_offers_featured
    ON public.job_offers (is_featured DESC, featured_until DESC);

COMMENT ON COLUMN public.job_offers.is_featured
    IS 'Offre mise en avant (future monétisation §29). FALSE partant : aucun tri ni affichage particulier pour l''instant.';
COMMENT ON COLUMN public.job_offers.featured_until
    IS 'Fin de la mise en avant (NULL = pas de mise en avant).';

ALTER TABLE public.candidate_profiles
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CONSTRAINT candidate_profiles_plan_check
        CHECK (plan IN ('free', 'premium'));

COMMENT ON COLUMN public.candidate_profiles.plan
    IS 'Offre du profil (§29) : ''free'' par défaut, ''premium'' réservé à la future monétisation.';

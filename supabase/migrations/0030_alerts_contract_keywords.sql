-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0030
--  Description : critères « type de contrat » et « mots-clés » des alertes
--  candidat (master prompt §8).
--
--  Une alerte doit pouvoir filtrer sur :
--    - le type de contrat recherché (CDI, CDD, Stage, Prestation,
--      Alternance, Freelance) ;
--    - une liste de mots-clés (séparés par des virgules) devant apparaître
--      dans l'offre.
--
--  Le matching est appliqué par le digest `scraper/alert_digest.py`
--  (`matches_job`), qui lit les mêmes colonnes. NULL = critère absent.
--
--  Aucune donnée existante n'est modifiée ni supprimée.
-- ============================================================================

ALTER TABLE public.alerts
    ADD COLUMN IF NOT EXISTS contract_type TEXT
    CONSTRAINT alerts_contract_type_check
        CHECK (
            contract_type IS NULL
            OR contract_type IN ('CDI', 'CDD', 'Stage', 'Prestation', 'Alternance', 'Freelance')
        );

ALTER TABLE public.alerts
    ADD COLUMN IF NOT EXISTS keywords TEXT;

COMMENT ON COLUMN public.alerts.contract_type
    IS 'Type de contrat recherché (CDI, CDD, Stage, Prestation, Alternance, Freelance). NULL = tous.';
COMMENT ON COLUMN public.alerts.keywords
    IS 'Mots-clés séparés par des virgules ; l''offre doit en contenir au moins un. NULL = aucun filtre.';

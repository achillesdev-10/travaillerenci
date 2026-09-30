-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0026
--  Description : enrichit candidate_profiles pour un vrai profil candidat
--  (métier recherché, niveau d'expérience, compétences, types de contrat
--   recherchés, présentation, lien CV).
--
--  Objectif (master prompt §9) : profil exploitable à long terme, indicateur
--  « profil complété à X % », meilleures recommandations.
--
--  Tous les champs sont NULLABLES / optionnels — aucune donnée existante n'est
--  modifiée ou supprimée. `resume_url` est un lien externe facultatif (le CV
--  n'est pas stocké ici) — prêt pour une future CVthèque (§30).
-- ============================================================================

ALTER TABLE public.candidate_profiles
    ADD COLUMN IF NOT EXISTS job_title        TEXT,
    ADD COLUMN IF NOT EXISTS experience_level TEXT,
    ADD COLUMN IF NOT EXISTS skills           TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS contract_types   TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS bio              TEXT,
    ADD COLUMN IF NOT EXISTS resume_url       TEXT;

COMMENT ON COLUMN public.candidate_profiles.job_title
    IS 'Métier / intitulé de poste recherché par le candidat.';
COMMENT ON COLUMN public.candidate_profiles.experience_level
    IS 'Niveau d''expérience (valeurs JOB_LEVELS de src/lib/constants.ts).';
COMMENT ON COLUMN public.candidate_profiles.skills
    IS 'Compétences libres du candidat (tableau texte).';
COMMENT ON COLUMN public.candidate_profiles.contract_types
    IS 'Types de contrat recherchés (valeurs JOB_TYPES de src/lib/constants.ts).';
COMMENT ON COLUMN public.candidate_profiles.bio
    IS 'Courte description professionnelle (texte libre).';
COMMENT ON COLUMN public.candidate_profiles.resume_url
    IS 'Lien facultatif vers un CV externe. Ne pas exposer publiquement sans consentement.';

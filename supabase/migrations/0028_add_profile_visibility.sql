-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0028
--  Description : consentement de visibilité du profil candidat (CVthèque
--  future — master prompt §30).
--
--  Un candidat devra pouvoir choisir entre « Visible par les recruteurs »
--  et « Profil privé ». Le champ est posé MAINTENANT, par défaut PRIVÉ :
--  aucune donnée n'est exposée sans consentement explicite et explicite.
--
--  Valeurs :
--    'private'     — défaut : profil strictement privé (aucun accès recruteur)
--    'recruiters'  — consentement donné : accessible à la future CVthèque
--
--  Aucune donnée existante n'est modifiée ni supprimée.
-- ============================================================================

ALTER TABLE public.candidate_profiles
    ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'private'
    CONSTRAINT candidate_profiles_visibility_check
        CHECK (profile_visibility IN ('private', 'recruiters'));

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_visibility
    ON public.candidate_profiles (profile_visibility);

COMMENT ON COLUMN public.candidate_profiles.profile_visibility
    IS 'Consentement de visibilité (CVthèque future) : ''private'' par défaut, ''recruiters'' uniquement si le candidat l''a activé explicitement.';

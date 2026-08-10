-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0015
--  Description : mini-profil candidat — les critères des alertes
--  (ville, diplôme le plus élevé, secteurs d'intérêt, téléphone WhatsApp).
--
--  Renseigné (optionnellement) à l'inscription, complétable depuis
--  /dashboard/candidate. Lecture/écriture via les routes serveur
--  /api/candidate/profile (service_role) — RLS fermée au client anon.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.candidate_profiles (
    user_id    UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    city       TEXT,
    diploma    TEXT,
    sectors    TEXT[] NOT NULL DEFAULT '{}',
    phone      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidate_profiles lecture service_role" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles lecture service_role"
    ON public.candidate_profiles FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "candidate_profiles insertion service_role" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles insertion service_role"
    ON public.candidate_profiles FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "candidate_profiles modif service_role" ON public.candidate_profiles;
CREATE POLICY "candidate_profiles modif service_role"
    ON public.candidate_profiles FOR UPDATE USING (FALSE);

COMMENT ON TABLE public.candidate_profiles
    IS 'Mini-profil candidat : critères d''alertes (ville, diplôme, secteurs, WhatsApp).';
COMMENT ON COLUMN public.candidate_profiles.sectors
    IS 'Slugs de secteurs d''intérêt (src/lib/constants.ts) — tableau texte.';
COMMENT ON COLUMN public.candidate_profiles.phone
    IS 'Numéro WhatsApp au format international (ex : 2250700000000).';

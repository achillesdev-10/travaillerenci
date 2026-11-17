-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0037
--  Carnet de candidatures externes (Sprint 1)
--
--  Objectif : permettre au candidat d'enregistrer une candidature qu'il va
--  finaliser lui-même chez l'employeur, puis de suivre son statut.
--
--  PRINCIPES :
--    • AUCUNE suppression de données ni de colonne existante.
--    • L'ancienne clé étrangère candidate_id -> profiles_candidate est
--      conservée (legacy), mais n'est plus utilisée par l'application.
--    • La nouvelle clé canonique est user_id -> public.users(id), car
--      l'authentification de l'application est custom (public.users).
--    • user_id reste NULLABLE : les lignes historiques sans correspondance
--      e-mail sont conservées telles quelles.
--    • RLS : aucune lecture/écriture anon ou authenticated ; seul le
--      service_role (routes serveur) peut accéder à la table.
--
--  À appliquer manuellement (jamais automatiquement en production) :
--    psql "$SUPABASE_DB_URL" -f supabase/migrations/0037_applications_carnet.sql
--  Rollback :
--    psql "$SUPABASE_DB_URL" -f supabase/rollbacks/0037_applications_carnet.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1. Colonnes du carnet (idempotent)
-- ----------------------------------------------------------------------------
ALTER TABLE public.applications
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS apply_method TEXT,
    ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- Les nouvelles candidatures naissent « à finaliser ». Les statuts legacy
-- restent lisibles et ne sont pas réécrits.
ALTER TABLE public.applications
    ALTER COLUMN status SET DEFAULT 'to_finalize';

-- ----------------------------------------------------------------------------
--  2. Backfill safe user_id par e-mail (uniquement si les tables legacy
--     existent réellement dans l'instance).
--     Chaîne : applications.candidate_id -> profiles_candidate.id
--              profiles_candidate.id     -> profiles.id
--              profiles.email            -> users.email (insensible à la casse)
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.profiles_candidate') IS NOT NULL
       AND to_regclass('public.profiles') IS NOT NULL
       AND to_regclass('public.users') IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'applications'
              AND column_name = 'candidate_id'
       )
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profiles_candidate'
              AND column_name = 'id'
       )
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profiles'
              AND column_name = 'id'
       )
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profiles'
              AND column_name = 'email'
       )
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users'
              AND column_name = 'id'
       )
       AND EXISTS (
           SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users'
              AND column_name = 'email'
       ) THEN
        -- En cas de doublons d'e-mail insensibles à la casse côté users, on ne
        -- devine pas : la candidature reste sans user_id (aucune perte de ligne).
        EXECUTE $backfill$
            WITH legacy_matches AS (
                SELECT pc.id AS candidate_id, (array_agg(u.id))[1] AS user_id
                  FROM public.profiles_candidate AS pc
                  JOIN public.profiles AS p ON p.id = pc.id
                  JOIN public.users AS u
                    ON lower(trim(u.email)) = lower(trim(p.email))
                 GROUP BY pc.id
                HAVING count(DISTINCT u.id) = 1
            )
            UPDATE public.applications AS a
               SET user_id = m.user_id
              FROM legacy_matches AS m
             WHERE a.user_id IS NULL
               AND a.candidate_id IS NOT NULL
               AND a.candidate_id = m.candidate_id
        $backfill$;
    END IF;
END $$;

-- Dates canoniques : on réutilise created_at, jamais une date inventée.
UPDATE public.applications
   SET applied_at = created_at
 WHERE applied_at IS NULL
   AND created_at IS NOT NULL;

UPDATE public.applications
   SET updated_at = COALESCE(applied_at, created_at)
 WHERE updated_at IS NULL;

-- ----------------------------------------------------------------------------
--  3. Index de lecture du carnet + anti-doublon par (offre, utilisateur)
--     L'index partiel ignore les lignes legacy sans user_id, ce qui préserve
--     les doublons historiques éventuels.
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS applications_job_user_unique
    ON public.applications (job_id, user_id)
    WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS applications_user_applied_idx
    ON public.applications (user_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS applications_job_idx
    ON public.applications (job_id);

-- ----------------------------------------------------------------------------
--  4. FK canonique vers public.users, ajoutée NOT VALID pour ne jamais
--     bloquer la migration sur une ligne legacy incohérente. Les nouvelles
--     écritures sont vérifiées immédiatement par PostgreSQL.
-- ----------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_constraint
         WHERE conname = 'applications_user_id_fkey'
           AND conrelid = 'public.applications'::regclass
    ) THEN
        ALTER TABLE public.applications
            ADD CONSTRAINT applications_user_id_fkey
            FOREIGN KEY (user_id)
            REFERENCES public.users(id)
            ON DELETE CASCADE
            NOT VALID;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
--  5. RLS : deny-by-default pour anon/authenticated.
--     Les routes Next.js utilisent service_role (bypass RLS). Les anciennes
--     policies permissives de 0002 restent en place mais sont neutralisées
--     par cette policy RESTRICTIVE (ET logique).
-- ----------------------------------------------------------------------------
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM pg_policies
         WHERE schemaname = 'public'
           AND tablename = 'applications'
           AND policyname = 'applications_backend_only'
    ) THEN
        CREATE POLICY applications_backend_only
            ON public.applications
            AS RESTRICTIVE
            FOR ALL
            TO anon, authenticated
            USING (false)
            WITH CHECK (false);
    END IF;
END $$;

COMMENT ON COLUMN public.applications.user_id IS
    'Utilisateur canonique (public.users.id). Remplace candidate_id pour l''authentification custom.';
COMMENT ON COLUMN public.applications.apply_method IS
    'Méthode de finalisation : external (site employeur) ou email. Ne signifie jamais que TravaillerEnCi a transmis la candidature.';
COMMENT ON COLUMN public.applications.applied_at IS
    'Date d''enregistrement de la candidature dans le carnet (backfill = created_at).';
COMMENT ON COLUMN public.applications.updated_at IS
    'Dernière modification du statut ou de la note du carnet.';

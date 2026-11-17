-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0037
--  Carnet de candidatures externes (Sprint 1, corrigée par l'audit 1.1)
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
--  ATOMICITÉ : tout le fichier est exécuté dans UNE transaction. Sans cela,
--  un échec au milieu du script (par exemple la création de l'index unique)
--  laissait la base à moitié migrée : colonnes ajoutées, backfill effectué,
--  mais sans index, sans FK et sans RLS.
--
--  À appliquer manuellement (jamais automatiquement en production) :
--    psql "$SUPABASE_DB_URL" -f supabase/migrations/0037_applications_carnet.sql
--  Rollback :
--    psql "$SUPABASE_DB_URL" -f supabase/rollbacks/0037_applications_carnet.sql
-- ============================================================================

BEGIN;

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
--
--  GARDE-FOUS (audit 1.1) :
--    • Seuls les comptes de rôle `candidate` sont rattachés. Un compte
--      entreprise partageant l'e-mail ne doit jamais hériter d'un carnet.
--    • Si plusieurs comptes correspondent au même e-mail, on ne devine pas :
--      la candidature reste sans user_id.
--    • Deux profils legacy distincts peuvent partager le même e-mail et donc
--      pointer vers le MÊME compte : la déduplication par (job_id, user_id)
--      ne garde que la plus ancienne, les autres restent `user_id = NULL`.
--      Sans cela, la création de l'index unique échoue et toute la migration
--      est annulée.
--    • Aucune ligne n'est supprimée ni fusionnée.
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
        EXECUTE $backfill$
            WITH legacy_matches AS (
                SELECT pc.id AS candidate_id, (array_agg(u.id))[1] AS user_id
                  FROM public.profiles_candidate AS pc
                  JOIN public.profiles AS p ON p.id = pc.id
                  JOIN public.users AS u
                    ON lower(trim(u.email)) = lower(trim(p.email))
                 WHERE u.role = 'candidate'
                 GROUP BY pc.id
                HAVING count(DISTINCT u.id) = 1
            ),
            candidates AS (
                SELECT a.id AS application_id,
                       m.user_id,
                       row_number() OVER (
                           PARTITION BY a.job_id, m.user_id
                           ORDER BY a.created_at, a.id
                       ) AS rank
                  FROM public.applications AS a
                  JOIN legacy_matches AS m ON m.candidate_id = a.candidate_id
                 WHERE a.user_id IS NULL
                   -- Une paire (offre, utilisateur) déjà migrée n'est pas retraitée.
                   AND NOT EXISTS (
                       SELECT 1 FROM public.applications AS x
                        WHERE x.job_id = a.job_id
                          AND x.user_id = m.user_id
                   )
            )
            UPDATE public.applications AS a
               SET user_id = c.user_id
              FROM candidates AS c
             WHERE a.id = c.application_id
               AND c.rank = 1
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
-- Pré-vol : si des doublons (job_id, user_id) subsistent (base déjà modifiée à
-- la main, ou ancienne exécution interrompue), on s'arrête avec un message
-- explicite au lieu de laisser PostgreSQL échouer sur l'index.
DO $$
DECLARE
    duplicate_pairs INTEGER;
BEGIN
    SELECT count(*) INTO duplicate_pairs
      FROM (
          SELECT 1
            FROM public.applications
           WHERE user_id IS NOT NULL
           GROUP BY job_id, user_id
          HAVING count(*) > 1
      ) AS duplicates;

    IF duplicate_pairs > 0 THEN
        RAISE EXCEPTION
            'Migration 0037 interrompue : % paire(s) (job_id, user_id) en doublon. Corrigez-les avant de relancer, aucune donnée n''a été modifiée.',
            duplicate_pairs;
    END IF;
END $$;

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

COMMIT;

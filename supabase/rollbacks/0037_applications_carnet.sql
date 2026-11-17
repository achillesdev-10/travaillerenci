-- ============================================================================
--  TravaillerEnCi — Rollback de la migration 0037
--  Carnet de candidatures externes
--
--  CE ROLLBACK NE SUPPRIME AUCUNE LIGNE DE public.applications.
--  Il retire uniquement les objets ajoutés par 0037.
--
--  ATTENTION : à n'exécuter qu'après avoir remis le code applicatif précédent
--  (sinon l'API /api/applications ne trouvera plus user_id/applied_at).
-- ============================================================================

DROP POLICY IF EXISTS applications_backend_only ON public.applications;

DROP INDEX IF EXISTS public.applications_job_idx;
DROP INDEX IF EXISTS public.applications_user_applied_idx;
DROP INDEX IF EXISTS public.applications_job_user_unique;

ALTER TABLE public.applications
    DROP CONSTRAINT IF EXISTS applications_user_id_fkey;

ALTER TABLE public.applications
    DROP COLUMN IF EXISTS resume_url,
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS applied_at,
    DROP COLUMN IF EXISTS apply_method,
    DROP COLUMN IF EXISTS user_id;

-- Restaure le défaut historique observé dans 0002.
ALTER TABLE public.applications
    ALTER COLUMN status SET DEFAULT 'pending';

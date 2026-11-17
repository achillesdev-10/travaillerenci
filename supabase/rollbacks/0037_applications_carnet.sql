-- ============================================================================
--  TravaillerEnCi — Rollback de la migration 0037
--  Carnet de candidatures externes
--
--  CE ROLLBACK NE SUPPRIME AUCUNE LIGNE DE public.applications.
--  Il retire uniquement les objets ajoutés par 0037.
--
--  ATTENTION : à n'exécuter qu'après avoir remis le code applicatif précédent
--  (sinon l'API /api/applications ne trouvera plus user_id/applied_at).
--
--  GARDE-FOU (audit 1.1) : les candidatures créées par le carnet n'ont pas de
--  candidate_id legacy (uniquement user_id). Supprimer user_id les laisserait
--  orphelines, invisibles du candidat et de tout futur code. Le rollback refuse
--  donc de s'exécuter s'il en existe. Exportez-les d'abord, puis forcez :
--      SET app.force_carnet_rollback = 'on';
--      \i supabase/rollbacks/0037_applications_carnet.sql
-- ============================================================================

BEGIN;

DO $$
DECLARE
    carnet_rows INTEGER;
BEGIN
    SELECT count(*) INTO carnet_rows
      FROM public.applications
     WHERE user_id IS NOT NULL
       AND candidate_id IS NULL;

    IF carnet_rows > 0
       AND coalesce(current_setting('app.force_carnet_rollback', true), '') <> 'on' THEN
        RAISE EXCEPTION
            'Rollback 0037 refusé : % candidature(s) du carnet perdraient leur rattachement utilisateur. Exportez-les, puis relancez avec SET app.force_carnet_rollback = ''on''.',
            carnet_rows;
    END IF;
END $$;

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

COMMIT;

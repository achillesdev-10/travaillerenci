-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0016
--  Description : éléments sauvegardés par les candidats (bouton étoile).
--
--  Couvre les 4 verticales via (item_type, item_id) :
--    job | internship | scholarship → id de public.job_offers
--    exam                            → id de public.exams
--
--  RLS fermée au client anon — passages par /api/saved (service_role).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.saved_items (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    item_type  TEXT NOT NULL
               CONSTRAINT saved_items_item_type_check
               CHECK (item_type IN ('job','internship','scholarship','exam')),
    item_id    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT saved_items_unique UNIQUE (user_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_items_user
    ON public.saved_items (user_id, created_at DESC);

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "saved_items lecture service_role" ON public.saved_items;
CREATE POLICY "saved_items lecture service_role"
    ON public.saved_items FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "saved_items insertion service_role" ON public.saved_items;
CREATE POLICY "saved_items insertion service_role"
    ON public.saved_items FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "saved_items suppression service_role" ON public.saved_items;
CREATE POLICY "saved_items suppression service_role"
    ON public.saved_items FOR DELETE USING (FALSE);

COMMENT ON TABLE public.saved_items
    IS 'Offres / stages / bourses / concours sauvegardés par un candidat (étoile).';
COMMENT ON COLUMN public.saved_items.item_type
    IS 'Type de contenu : job, internship, scholarship (job_offers) ou exam (exams).';
COMMENT ON COLUMN public.saved_items.item_id
    IS 'ID de la fiche dans job_offers ou exams (selon item_type).';

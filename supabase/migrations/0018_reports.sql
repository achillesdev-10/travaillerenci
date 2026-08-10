-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0018
--  Description : signalements d'abus soumis depuis les fiches (module
--  « Signaler une offre / un contenu », remplace l'ancien lien mailto).
--
--  • `reporter_user_id` : candidat connecté (nullable — signalement anonyme
--    autorisé, sans obligation de compte pour ne pas freiner la remontée).
--  • `item_type` / `item_id` : cible du signalement (job | internship |
--    scholarship → public.job_offers, exam → public.exams).
--  • `reason` : motif normalisé (liste fermée, détaillée dans l'UI).
--  • `status` : pending → résolu (contenu modéré) ou classé (sans suite).
--
--  RLS fermée au client anon — écriture via /api/reports (service_role),
--  lecture/modération via /api/admin/reports (session admin).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.reports (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reporter_email   TEXT,
    item_type        TEXT NOT NULL
                     CONSTRAINT reports_item_type_check
                     CHECK (item_type IN ('job','internship','scholarship','exam')),
    item_id          TEXT NOT NULL,
    reason           TEXT NOT NULL
                     CONSTRAINT reports_reason_check
                     CHECK (reason IN
                       ('frais_demandes','contenu_frauduleux','info_inexacte',
                        'contenu_inapproprie','autre')),
    details          TEXT,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CONSTRAINT reports_status_check
                     CHECK (status IN ('pending','resolved','dismissed')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at      TIMESTAMPTZ,
    resolved_by      TEXT
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_item ON public.reports (item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports (reporter_user_id);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports lecture service_role" ON public.reports;
CREATE POLICY "reports lecture service_role"
    ON public.reports FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "reports insertion service_role" ON public.reports;
CREATE POLICY "reports insertion service_role"
    ON public.reports FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "reports modif service_role" ON public.reports;
CREATE POLICY "reports modif service_role"
    ON public.reports FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS "reports suppression service_role" ON public.reports;
CREATE POLICY "reports suppression service_role"
    ON public.reports FOR DELETE USING (FALSE);

COMMENT ON TABLE public.reports
    IS 'Signalements d''abus soumis depuis les fiches (anti-arnaque).';
COMMENT ON COLUMN public.reports.reporter_user_id
    IS 'Candidat connecté à l''origine du signalement — NULL si anonyme.';
COMMENT ON COLUMN public.reports.reason
    IS 'Motif normalisé : frais_demandes, contenu_frauduleux, info_inexacte, contenu_inapproprie, autre.';
COMMENT ON COLUMN public.reports.status
    IS 'pending (file de modération) → resolved (contenu traité) ou dismissed (classé sans suite).';

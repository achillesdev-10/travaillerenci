-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0027
--  Description : table des événements produits (master prompt §22).
--
--  Événements : job_view, job_save, job_unsave, signup, profile_complete,
--  cv_upload, alert_create, application_click, search, share.
--
--  CONFIDENTIALITÉ : aucune donnée personnelle n'y est stockée — uniquement
--  un identifiant d'objet (label), un chemin (path), un hash d'IP et l'horodate.
--  Les événements « une fois par utilisateur » sont dédupliqués côté serveur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event      TEXT        NOT NULL,
    label      TEXT,
    path       TEXT,
    user_id    UUID,
    ip_hash    TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_created
    ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created
    ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_event
    ON public.analytics_events (user_id, event);

-- RLS fermée au client anon : lecture/écriture via le service_role uniquement.
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events lecture service_role" ON public.analytics_events;
CREATE POLICY "analytics_events lecture service_role"
    ON public.analytics_events FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "analytics_events insertion service_role" ON public.analytics_events;
CREATE POLICY "analytics_events insertion service_role"
    ON public.analytics_events FOR INSERT WITH CHECK (FALSE);

COMMENT ON TABLE public.analytics_events
    IS 'Événements produits (mesure §22) — aucune donnée personnelle.';
COMMENT ON COLUMN public.analytics_events.label
    IS 'Identifiant d''objet (id d''offre, id d''alerte, rôle) — jamais de donnée personnelle.';

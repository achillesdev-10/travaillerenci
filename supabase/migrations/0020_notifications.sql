-- Migration: Notifications candidat
-- Path: supabase/migrations/0020_notifications.sql
--
-- Table `notifications` pour stocker les notifications récentes du candidat :
-- alertes déclenchées, événements de compte, mises à jour de sauvegardes, etc.

CREATE TABLE IF NOT EXISTS public.notifications (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    type       TEXT NOT NULL CHECK (type IN ('alert_match', 'saved_update', 'account_event', 'system')),
    title      TEXT NOT NULL,
    body       TEXT,
    link       TEXT,
    item_type  TEXT,
    item_id    TEXT,
    read       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour les requêtes fréquentes : liste par user (triées par date), compteur non-lues
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications (user_id, read, created_at DESC);

-- RLS : fermée pour le client anon, ouverte uniquement au rôle service.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications lecture service_role"
    ON public.notifications FOR SELECT
    USING (FALSE);

CREATE POLICY "notifications insertion service_role"
    ON public.notifications FOR INSERT
    WITH CHECK (FALSE);

CREATE POLICY "notifications update service_role"
    ON public.notifications FOR UPDATE
    USING (FALSE);

CREATE POLICY "notifications delete service_role"
    ON public.notifications FOR DELETE
    USING (FALSE);

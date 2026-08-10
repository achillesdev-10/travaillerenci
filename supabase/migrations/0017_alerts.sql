-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0017
--  Description : alertes candidat (email / WhatsApp) + journal des envois.
--
--  • `alerts`          : critères (types de contenu, ville, diplôme, secteur),
--    canal (email / whatsapp / both), fréquence (immediate / daily) et jeton
--    de désinscription unique envoyé dans chaque notification.
--  • `alert_digest_log`: déduplication — une ligne par (alerte, élément)
--    notifié ; alimentée par scraper/alert_digest.py (workflow auto-publish).
--
--  RLS fermée au client anon — routes /api/alerts + digest (service_role).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.alerts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    label             TEXT NOT NULL,
    content_types     TEXT[] NOT NULL DEFAULT '{}'
                      CONSTRAINT alerts_content_types_check
                      CHECK (content_types <@ ARRAY['job','internship','scholarship','exam']::TEXT[]),
    city              TEXT,
    diploma           TEXT,
    sector            TEXT,
    channels          TEXT NOT NULL DEFAULT 'email'
                      CONSTRAINT alerts_channels_check
                      CHECK (channels IN ('email','whatsapp','both')),
    frequency         TEXT NOT NULL DEFAULT 'immediate'
                      CONSTRAINT alerts_frequency_check
                      CHECK (frequency IN ('immediate','daily')),
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    last_sent_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON public.alerts (user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON public.alerts (active);
CREATE INDEX IF NOT EXISTS idx_alerts_token ON public.alerts (unsubscribe_token);

CREATE TABLE IF NOT EXISTS public.alert_digest_log (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id  UUID NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL
              CONSTRAINT alert_digest_log_item_type_check
              CHECK (item_type IN ('job','internship','scholarship','exam')),
    item_id   TEXT NOT NULL,
    sent_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT alert_digest_log_unique UNIQUE (alert_id, item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_alert_digest_alert ON public.alert_digest_log (alert_id);

-- RLS : fermée au client anon (seul le service_role lit/écrit).
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_digest_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "alerts lecture service_role" ON public.alerts;
CREATE POLICY "alerts lecture service_role"
    ON public.alerts FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "alerts insertion service_role" ON public.alerts;
CREATE POLICY "alerts insertion service_role"
    ON public.alerts FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "alerts modif service_role" ON public.alerts;
CREATE POLICY "alerts modif service_role"
    ON public.alerts FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS "alerts suppression service_role" ON public.alerts;
CREATE POLICY "alerts suppression service_role"
    ON public.alerts FOR DELETE USING (FALSE);

DROP POLICY IF EXISTS "alert_digest_log lecture service_role" ON public.alert_digest_log;
CREATE POLICY "alert_digest_log lecture service_role"
    ON public.alert_digest_log FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "alert_digest_log insertion service_role" ON public.alert_digest_log;
CREATE POLICY "alert_digest_log insertion service_role"
    ON public.alert_digest_log FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "alert_digest_log suppression service_role" ON public.alert_digest_log;
CREATE POLICY "alert_digest_log suppression service_role"
    ON public.alert_digest_log FOR DELETE USING (FALSE);

COMMENT ON TABLE public.alerts
    IS 'Alertes candidat : critères de matching + canal (email/WhatsApp) + fréquence.';
COMMENT ON COLUMN public.alerts.content_types
    IS 'Types de contenu surveillés (job, internship, scholarship, exam) — vide = tous.';
COMMENT ON COLUMN public.alerts.unsubscribe_token
    IS 'Jeton unique de désinscription (lié dans chaque notification).';
COMMENT ON COLUMN public.alerts.last_sent_at
    IS 'Dernier envoi effectif — limite la fréquence quotidienne à 1 envoi/jour.';
COMMENT ON TABLE public.alert_digest_log
    IS 'Déduplication des envois : une ligne par (alerte, élément) notifié.';

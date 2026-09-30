-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0029
--  Description : architecture newsletter / futures alertes email (§20).
--
--  Aucun service d'envoi n'est mis en place ici : seuls les CHAMPS nécessaires
--  sont créés pour que la newsletter, les alertes email et les notifications
--  puissent être branchés plus tard sans nouvelle migration.
--
--  Champs clés :
--    • email + statut (pending / active / unsubscribed / bounced)
--    • consentement explicite horodaté (texte exact accepté)
--    • source du formulaire et paramètres UTM (origine du trafic, §21)
--    • fréquence d'envoi prévue + jeton de désinscription en un clic
--    • jeton de confirmation (double opt-in prêt à être activé)
--
--  Aucune donnée existante n'est modifiée ni supprimée.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CONSTRAINT newsletter_status_check
                      CHECK (status IN ('pending', 'active', 'unsubscribed', 'bounced')),
    source            TEXT NOT NULL DEFAULT 'footer',
    frequency         TEXT NOT NULL DEFAULT 'hebdomadaire'
                      CONSTRAINT newsletter_frequency_check
                      CHECK (frequency IN ('hebdomadaire', 'mensuelle')),
    consent_text      TEXT,
    consent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    utm_source        TEXT,
    utm_medium        TEXT,
    utm_campaign      TEXT,
    confirm_token     TEXT UNIQUE,
    confirmed_at      TIMESTAMPTZ,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    unsubscribed_at   TIMESTAMPTZ,
    last_sent_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicité insensible à la casse : les adresses sont normalisées en minuscules
-- côté applicatif, l'index protège aussi l'entrée brute.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email
    ON public.newsletter_subscribers (lower(email));

CREATE INDEX IF NOT EXISTS idx_newsletter_status
    ON public.newsletter_subscribers (status);

-- RLS fermée au client anon : tout passe par les routes serveur (service_role).
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter lecture service_role" ON public.newsletter_subscribers;
CREATE POLICY "newsletter lecture service_role"
    ON public.newsletter_subscribers FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "newsletter insertion service_role" ON public.newsletter_subscribers;
CREATE POLICY "newsletter insertion service_role"
    ON public.newsletter_subscribers FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "newsletter modification service_role" ON public.newsletter_subscribers;
CREATE POLICY "newsletter modification service_role"
    ON public.newsletter_subscribers FOR UPDATE USING (FALSE);

COMMENT ON TABLE public.newsletter_subscribers
    IS 'Abonnés newsletter (§20) — champs préparatoires, aucun envoi automatisé à ce jour.';
COMMENT ON COLUMN public.newsletter_subscribers.consent_text
    IS 'Texte de consentement exact accepté par l''abonné au moment de l''inscription.';
COMMENT ON COLUMN public.newsletter_subscribers.unsubscribe_token
    IS 'Jeton du lien de désinscription en un clic envoyé dans chaque email.';

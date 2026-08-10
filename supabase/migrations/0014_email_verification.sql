-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0014
--  Description : vérification d'email à l'inscription.
--
--  • Colonne `email_verified` sur public.users (confirmée par lien ou par
--    Google au moment du SSO).
--  • Table `verify_email_tokens` : jeton à usage unique (hash SHA-256),
--    validité 24 h — même convention que password_reset_tokens.
--
--  RLS : fermée au client anon (USING (FALSE)) — les routes serveur
--  /api/auth/verify-email utilisent le service_role, comme pour users.
-- ============================================================================

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.verify_email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verify_email_tokens_user
    ON public.verify_email_tokens (user_id);

ALTER TABLE public.verify_email_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "verify_email_tokens lecture service_role" ON public.verify_email_tokens;
CREATE POLICY "verify_email_tokens lecture service_role"
    ON public.verify_email_tokens FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "verify_email_tokens insertion service_role" ON public.verify_email_tokens;
CREATE POLICY "verify_email_tokens insertion service_role"
    ON public.verify_email_tokens FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "verify_email_tokens suppression service_role" ON public.verify_email_tokens;
CREATE POLICY "verify_email_tokens suppression service_role"
    ON public.verify_email_tokens FOR DELETE USING (FALSE);

COMMENT ON COLUMN public.users.email_verified
    IS 'Vrai si l''adresse email a été confirmée (lien de vérification ou SSO Google).';
COMMENT ON TABLE public.verify_email_tokens
    IS 'Jetons de vérification d''email à usage unique (hash, validité 24 h).';

-- Migration 0024: Table des notifications admin
-- Stocke les notifications du centre de notifications unifié (bell icon).

CREATE TABLE IF NOT EXISTS admin_notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL DEFAULT 'system'
                CHECK (type IN (
                  'scraper_error',
                  'scraper_alert',
                  'new_report',
                  'new_recruiter_pending',
                  'new_comment_reported',
                  'system'
                )),
  message     TEXT NOT NULL,
  link        TEXT,
  read        BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour la requête principale (non-lues triées par date)
CREATE INDEX IF NOT EXISTS idx_admin_notifications_read_created
  ON admin_notifications (read, created_at DESC);

-- RLS : seuls les admins peuvent lire/écrire
ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read notifications"
  ON admin_notifications FOR SELECT
  USING (auth.jwt() ->> 'email' = current_setting('app.settings.admin_email', true));

CREATE POLICY "Admins can insert notifications"
  ON admin_notifications FOR INSERT
  WITH CHECK (auth.jwt() ->> 'email' = current_setting('app.settings.admin_email', true));

CREATE POLICY "Admins can update notifications"
  ON admin_notifications FOR UPDATE
  USING (auth.jwt() ->> 'email' = current_setting('app.settings.admin_email', true));

CREATE POLICY "Admins can delete notifications"
  ON admin_notifications FOR DELETE
  USING (auth.jwt() ->> 'email' = current_setting('app.settings.admin_email', true));

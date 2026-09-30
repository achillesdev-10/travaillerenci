/**
 *  TravaillerEnCi — src/services/newsletterService.ts
 *
 *  Architecture newsletter / futures alertes email (master prompt §20).
 *  Ce service gère UNIQUEMENT l'enregistrement des inscriptions et la
 *  désinscription en un clic : aucun envoi n'est implémenté à ce stade.
 *
 *  • Local : SQLite (table `newsletter_subscribers`, ./data/travaillerenci.sqlite3)
 *  • Prod  : Supabase (migration 0029_newsletter_subscribers.sql) — service_role.
 *
 *  RLS Supabase fermée au client anon : passages par POST /api/newsletter.
 */

import 'server-only';
import { randomBytes } from 'node:crypto';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import {
  DEFAULT_NEWSLETTER_STATUS,
  NEWSLETTER_CONSENT_TEXT,
  normalizeNewsletterEmail,
  normalizeNewsletterFrequency,
  normalizeNewsletterSource,
  normalizeNewsletterStatus,
  isValidNewsletterEmail,
  type NewsletterFrequency,
  type NewsletterSource,
  type NewsletterStatus,
} from '@/lib/newsletter';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  status: NewsletterStatus;
  source: NewsletterSource;
  frequency: NewsletterFrequency;
  consent_text: string | null;
  consent_at: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  confirm_token: string | null;
  confirmed_at: string | null;
  unsubscribe_token: string;
  unsubscribed_at: string | null;
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsletterSubscribeInput {
  email: unknown;
  source?: unknown;
  frequency?: unknown;
  consent_text?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
}

export type NewsletterSubscribeResult =
  | { ok: true; already: boolean; subscriber: NewsletterSubscriber }
  | { ok: false; error: string };

type DatabaseSyncInstance = {
  prepare(sql: string): StatementInstance;
  exec(sql: string): void;
  close(): void;
};
type StatementInstance = {
  run(params?: unknown): { changes: number; lastInsertRowid: unknown };
  get(params?: unknown): any | undefined;
  all(params?: unknown): any[];
};

let cachedDb: DatabaseSyncInstance | null = null;

async function getDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb) return cachedDb;
  try {
    const mod = await import('node:sqlite');
    const { DatabaseSync } = mod as unknown as {
      DatabaseSync: new (path: string) => DatabaseSyncInstance;
    };
    const { resolve: resolvePath } = (await import('node:path')) as typeof import('node:path');
    const { existsSync: exists, mkdirSync: mkdir } = (await import('node:fs')) as typeof import('node:fs');
    const dataDir = resolvePath(process.cwd(), 'data');
    if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    cachedDb = new DatabaseSync(resolvePath(dataDir, 'travaillerenci.sqlite3'));
    cachedDb.exec(`
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
        email             TEXT NOT NULL UNIQUE,
        status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','unsubscribed','bounced')),
        source            TEXT NOT NULL DEFAULT 'footer',
        frequency         TEXT NOT NULL DEFAULT 'hebdomadaire' CHECK (frequency IN ('hebdomadaire','mensuelle')),
        consent_text      TEXT,
        consent_at        TEXT NOT NULL DEFAULT (datetime('now')),
        utm_source        TEXT,
        utm_medium        TEXT,
        utm_campaign      TEXT,
        confirm_token     TEXT UNIQUE,
        confirmed_at      TEXT,
        unsubscribe_token TEXT NOT NULL UNIQUE,
        unsubscribed_at   TEXT,
        last_sent_at      TEXT,
        created_at        TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_newsletter_status ON newsletter_subscribers (status);
    `);
    return cachedDb;
  } catch {
    return null;
  }
}

function textOrNull(value: unknown, max = 255): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim().slice(0, max);
  return clean || null;
}

function rowToSubscriber(row: any): NewsletterSubscriber {
  return {
    id: String(row.id),
    email: String(row.email || ''),
    status: normalizeNewsletterStatus(row.status),
    source: normalizeNewsletterSource(row.source),
    frequency: normalizeNewsletterFrequency(row.frequency),
    consent_text: row.consent_text ?? null,
    consent_at: String(row.consent_at || ''),
    utm_source: row.utm_source ?? null,
    utm_medium: row.utm_medium ?? null,
    utm_campaign: row.utm_campaign ?? null,
    confirm_token: row.confirm_token ?? null,
    confirmed_at: row.confirmed_at ?? null,
    unsubscribe_token: String(row.unsubscribe_token || ''),
    unsubscribed_at: row.unsubscribed_at ?? null,
    last_sent_at: row.last_sent_at ?? null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}

export class NewsletterService {
  /**
   * Inscrit une adresse à la newsletter (idempotent).
   * Une ré-inscription après désinscription repasse l'abonné en « pending »
   * et renouvelle le consentement horodaté.
   */
  static async subscribe(input: NewsletterSubscribeInput): Promise<NewsletterSubscribeResult> {
    const email = normalizeNewsletterEmail(input.email);
    if (!isValidNewsletterEmail(email)) {
      return { ok: false, error: 'Adresse email invalide.' };
    }

    const now = new Date().toISOString();
    const unsubscribeToken = randomBytes(24).toString('hex');
    const confirmToken = randomBytes(24).toString('hex');
    const source = normalizeNewsletterSource(input.source);
    const frequency = normalizeNewsletterFrequency(input.frequency);
    const consentText =
      typeof input.consent_text === 'string' && input.consent_text.trim()
        ? input.consent_text.trim().slice(0, 300)
        : NEWSLETTER_CONSENT_TEXT;
    const utmSource = textOrNull(input.utm_source, 80);
    const utmMedium = textOrNull(input.utm_medium, 80);
    const utmCampaign = textOrNull(input.utm_campaign, 80);

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return { ok: false, error: 'Service indisponible.' };

      const { data: existing } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (existing && normalizeNewsletterStatus(existing.status) !== 'unsubscribed') {
        return { ok: true, already: true, subscriber: rowToSubscriber(existing) };
      }

      const payload = {
        status: DEFAULT_NEWSLETTER_STATUS,
        source,
        frequency,
        consent_text: consentText,
        consent_at: now,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        confirm_token: confirmToken,
        confirmed_at: null,
        unsubscribe_token: unsubscribeToken,
        unsubscribed_at: null,
        updated_at: now,
      };

      if (existing) {
        const { data, error } = await supabase
          .from('newsletter_subscribers')
          .update({ ...payload, email })
          .eq('id', existing.id)
          .select()
          .maybeSingle();
        if (error || !data) {
          console.error('newsletterService.subscribe error:', error?.message);
          return { ok: false, error: "Impossible d'enregistrer l'inscription." };
        }
        return { ok: true, already: false, subscriber: rowToSubscriber(data) };
      }

      const { data, error } = await supabase
        .from('newsletter_subscribers')
        .insert({ email, created_at: now, ...payload })
        .select()
        .maybeSingle();
      if (error || !data) {
        console.error('newsletterService.subscribe error:', error?.message);
        return { ok: false, error: "Impossible d'enregistrer l'inscription." };
      }
      return { ok: true, already: false, subscriber: rowToSubscriber(data) };
    }

    const db = await getDb();
    if (!db) return { ok: false, error: 'Service indisponible.' };

    const existingRow = db
      .prepare('SELECT * FROM newsletter_subscribers WHERE email = $email')
      .get({ $email: email });

    if (existingRow && normalizeNewsletterStatus(existingRow.status) !== 'unsubscribed') {
      return { ok: true, already: true, subscriber: rowToSubscriber(existingRow) };
    }

    if (existingRow) {
      db.prepare(
        `UPDATE newsletter_subscribers SET
           status = $status, source = $source, frequency = $frequency,
           consent_text = $consentText, consent_at = $now,
           utm_source = $utmSource, utm_medium = $utmMedium, utm_campaign = $utmCampaign,
           confirm_token = $confirmToken, confirmed_at = NULL,
           unsubscribe_token = $unsubscribeToken, unsubscribed_at = NULL,
           updated_at = $now
         WHERE id = $id`,
      ).run({
        $status: DEFAULT_NEWSLETTER_STATUS,
        $source: source,
        $frequency: frequency,
        $consentText: consentText,
        $utmSource: utmSource,
        $utmMedium: utmMedium,
        $utmCampaign: utmCampaign,
        $confirmToken: confirmToken,
        $unsubscribeToken: unsubscribeToken,
        $now: now,
        $id: existingRow.id,
      });
      const updated = db
        .prepare('SELECT * FROM newsletter_subscribers WHERE id = $id')
        .get({ $id: existingRow.id });
      return updated
        ? { ok: true, already: false, subscriber: rowToSubscriber(updated) }
        : { ok: false, error: "Impossible d'enregistrer l'inscription." };
    }

    db.prepare(
      `INSERT INTO newsletter_subscribers
         (email, status, source, frequency, consent_text, consent_at,
          utm_source, utm_medium, utm_campaign, confirm_token,
          unsubscribe_token, created_at, updated_at)
       VALUES
         ($email, $status, $source, $frequency, $consentText, $now,
          $utmSource, $utmMedium, $utmCampaign, $confirmToken,
          $unsubscribeToken, $now, $now)`,
    ).run({
      $email: email,
      $status: DEFAULT_NEWSLETTER_STATUS,
      $source: source,
      $frequency: frequency,
      $consentText: consentText,
      $utmSource: utmSource,
      $utmMedium: utmMedium,
      $utmCampaign: utmCampaign,
      $confirmToken: confirmToken,
      $unsubscribeToken: unsubscribeToken,
      $now: now,
    });
    const created = db
      .prepare('SELECT * FROM newsletter_subscribers WHERE email = $email')
      .get({ $email: email });
    return created
      ? { ok: true, already: false, subscriber: rowToSubscriber(created) }
      : { ok: false, error: "Impossible d'enregistrer l'inscription." };
  }

  /** Recherche par jeton de désinscription (lien « se désinscrire en un clic »). */
  static async findByUnsubscribeToken(token: string): Promise<NewsletterSubscriber | null> {
    if (!token) return null;
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return null;
      const { data } = await supabase
        .from('newsletter_subscribers')
        .select('*')
        .eq('unsubscribe_token', token)
        .maybeSingle();
      return data ? rowToSubscriber(data) : null;
    }
    const db = await getDb();
    if (!db) return null;
    const row = db
      .prepare('SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = $token')
      .get({ $token: token });
    return row ? rowToSubscriber(row) : null;
  }

  /** Désactive l'abonnement (idempotent). Retourne false si le jeton est inconnu. */
  static async unsubscribeByToken(token: string): Promise<boolean> {
    const subscriber = await NewsletterService.findByUnsubscribeToken(token);
    if (!subscriber) return false;
    if (subscriber.status === 'unsubscribed') return true;

    const now = new Date().toISOString();
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;
      const { error } = await supabase
        .from('newsletter_subscribers')
        .update({ status: 'unsubscribed', unsubscribed_at: now, updated_at: now })
        .eq('id', subscriber.id);
      if (error) {
        console.error('newsletterService.unsubscribeByToken error:', error.message);
        return false;
      }
      return true;
    }

    const db = await getDb();
    if (!db) return false;
    db.prepare(
      `UPDATE newsletter_subscribers
         SET status = 'unsubscribed', unsubscribed_at = $now, updated_at = $now
       WHERE id = $id`,
    ).run({ $now: now, $id: subscriber.id });
    return true;
  }
}

import { NextResponse } from "next/server";
import { mkdirSync } from "node:fs";
import path from "node:path";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { getSessionUser } from "@/lib/userSession";
import { recordEvent, recordEvents, type AnalyticsEventInput } from "@/services/analyticsService";
import { isAnalyticsEvent, type AnalyticsEventName } from "@/lib/analyticsEvents";
import { normalizeSource } from "@/lib/trafficSource";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";

const DB_PATH = path.join(process.cwd(), "data", "travaillerenci.sqlite3");

export const dynamic = "force-dynamic";

/** Taille max d'une requête groupée (visites + événements). */
const MAX_BATCH = 50;

/** Shape minimal de node:sqlite.DatabaseSync (import dynamique ci-dessous). */
type SqliteDb = {
  exec(sql: string): void;
  prepare(sql: string): {
    run(...args: unknown[]): { changes: number };
    all(...args: unknown[]): unknown[];
  };
  close(): void;
};

type VisitInput = { path: string; source: string };

function ensureTable(db: SqliteDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      path TEXT NOT NULL,
      source TEXT,
      ip_hash TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON site_visits (created_at DESC);
  `);
  // Migration défensive (§23) : table créée avant l'ajout de `source`.
  try {
    const cols = db.prepare("PRAGMA table_info(site_visits)").all() as Array<{ name: string }>;
    if (!cols.some((c) => String(c.name) === "source")) {
      db.exec("ALTER TABLE site_visits ADD COLUMN source TEXT");
    }
  } catch {
    // colonne déjà présente ou PRAGMA indisponible : on continue
  }
}

function hashIp(ip: string) {
  return Buffer.from(ip).toString("base64").slice(0, 16);
}

/** Écriture locale (SQLite) — utilisée hors production ou en secours.
 *  Import DYNAMIQUE de node:sqlite : ce module n'existe que dans le runtime
 *  Node 22+ ; un import statique casse le build/bundling (module natif) et
 *  chargerait le runtime SQLite sur chaque invocation en production, où ce
 *  chemin n'est utilisé que comme fallback en cas d'échec Supabase.
 *  Sur Vercel, le système de fichiers est en lecture seule : on évite
 *  d'importer node:sqlite et de tenter une écriture vouée à l'échec. */
async function trackManyInSqlite(visits: VisitInput[], userAgent: string, ip: string) {
  if (visits.length === 0) return true;
  if (process.env.VERCEL) return false;
  try {
    const { DatabaseSync } = await import("node:sqlite");
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH) as unknown as SqliteDb;
    ensureTable(db);
    const insert = db.prepare(
      "INSERT INTO site_visits (path, source, ip_hash, user_agent) VALUES (?, ?, ?, ?)",
    );
    for (const visit of visits) {
      insert.run(visit.path, visit.source, hashIp(ip), userAgent.slice(0, 255));
    }
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Écriture Supabase (production, FS en lecture seule). */
async function trackManyInSupabase(visits: VisitInput[], userAgent: string, ip: string) {
  if (visits.length === 0) return true;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const rows = visits.map((visit) => ({
    path: visit.path,
    source: visit.source,
    ip_hash: hashIp(ip),
    user_agent: userAgent.slice(0, 255),
  }));

  const { error } = await supabase.from("site_visits").insert(rows);
  if (!error) return true;

  // Migration 0031 non appliquée : colonne `source` inconnue → on réessaie
  // sans elle plutôt que de perdre les visites.
  if (/source|column/i.test(error.message || "")) {
    const retry = await supabase.from("site_visits").insert(
      rows.map((row) => ({
        path: row.path,
        ip_hash: row.ip_hash,
        user_agent: row.user_agent,
      })),
    );
    return !retry.error;
  }
  return false;
}

async function storeVisits(visits: VisitInput[], userAgent: string, ip: string) {
  if (visits.length === 0) return true;
  if (isSupabaseConfigured()) {
    const ok = await trackManyInSupabase(visits, userAgent, ip);
    if (ok) return true;
    return trackManyInSqlite(visits, userAgent, ip);
  }
  return trackManyInSqlite(visits, userAgent, ip);
}

/** Requête groupée envoyée par analyticsClient.ts (visites + événements). */
async function handleBatch(raw: unknown[], userAgent: string, ip: string) {
  const items = raw.slice(0, MAX_BATCH);
  const visits: VisitInput[] = [];
  const events: AnalyticsEventInput[] = [];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const entry = item as Record<string, unknown>;

    if (entry.kind === "event" || isAnalyticsEvent(entry.event)) {
      if (!isAnalyticsEvent(entry.event)) continue;
      const event = entry.event as AnalyticsEventName;
      const pagePath = String(entry.path || "/").slice(0, 500);
      if (pagePath.startsWith("/cz7tk")) continue;
      events.push({
        event,
        label: typeof entry.label === "string" ? entry.label.slice(0, 200) : null,
        path: pagePath,
      });
      continue;
    }

    const pagePath = String(entry.path || "/").slice(0, 500);
    if (pagePath.startsWith("/cz7tk")) continue;
    visits.push({ path: pagePath, source: normalizeSource(entry.source) });
  }

  if (visits.length === 0 && events.length === 0) {
    return NextResponse.json({ tracked: false, batch: true });
  }

  const session = events.length > 0 ? await getSessionUser() : null;
  if (session?.userId) {
    for (const event of events) event.userId = session.userId;
  }

  const [visitsOk, eventsOk] = await Promise.all([
    storeVisits(visits, userAgent, ip),
    events.length > 0 ? recordEvents(events) : Promise.resolve(true),
  ]);

  return NextResponse.json({
    tracked: visitsOk || eventsOk,
    batch: true,
    visits: visitsOk ? visits.length : 0,
    events: eventsOk ? events.length : 0,
  });
}

export async function POST(request: Request) {
  try {
    // Anti-spam : plafond très généreux (200 / 10 min par IP) — vise les floods
    // d'insertions, jamais la navigation humaine, y compris derrière une IP
    // partagée (cybercafé, opérateur mobile). Un refus ne bloque rien : la
    // visite n'est simplement pas comptée.
    if (isRateLimited(`track:${getClientIp(request)}`, 200, 10 * 60 * 1000)) {
      return NextResponse.json({ tracked: false }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const userAgent = request.headers.get("user-agent") || "";
    if (/bot|crawl|spider|slurp|lighthouse/i.test(userAgent)) {
      return NextResponse.json({ tracked: false, bot: true });
    }

    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

    // ── Mode groupé : un seul POST pour toutes les visites/événements ──────
    if (Array.isArray(body.batch)) {
      return handleBatch(body.batch, userAgent, ip);
    }

    const pagePath = String(body.path || "/");

    // Ignore admin routes or bots if desired
    if (pagePath.startsWith("/cz7tk")) {
      return NextResponse.json({ tracked: false });
    }

    // ── Événements produits (§22) : job_view, job_save, signup… ────────────
    if (isAnalyticsEvent(body.event)) {
      const session = await getSessionUser(); // JWT uniquement, sans lecture BDD
      const ok = await recordEvent({
        event: body.event as AnalyticsEventName,
        label: typeof body.label === "string" ? body.label.slice(0, 200) : null,
        path: pagePath,
        userId: session?.userId ?? null,
      });
      return NextResponse.json({ tracked: ok, event: body.event });
    }

    // Source de trafic (§23) : utm_source / domaine d'origine / direct.
    const source = normalizeSource(body.source);
    const ok = await storeVisits([{ path: pagePath, source }], userAgent, ip);
    return NextResponse.json({ tracked: ok });
  } catch (err) {
    return NextResponse.json({ tracked: false, error: String(err) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";
import { getSessionUser } from "@/lib/userSession";
import { recordEvent } from "@/services/analyticsService";
import { isAnalyticsEvent, type AnalyticsEventName } from "@/lib/analyticsEvents";
import { normalizeSource } from "@/lib/trafficSource";
import { getClientIp, isRateLimited } from "@/lib/rateLimit";

const DB_PATH = path.join(process.cwd(), "data", "travaillerenci.sqlite3");

export const dynamic = "force-dynamic";

function ensureTable(db: InstanceType<typeof DatabaseSync>) {
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

/** Écriture locale (SQLite) — utilisée hors production ou en secours. */
function trackInSqlite(pagePath: string, source: string, userAgent: string, ip: string) {
  try {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    ensureTable(db);
    db.prepare(
      "INSERT INTO site_visits (path, source, ip_hash, user_agent) VALUES (?, ?, ?, ?)",
    ).run(pagePath, source, hashIp(ip), userAgent.slice(0, 255));
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Écriture Supabase (production, FS en lecture seule). */
async function trackInSupabase(pagePath: string, source: string, userAgent: string, ip: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("site_visits").insert({
    path: pagePath,
    source,
    ip_hash: hashIp(ip),
    user_agent: userAgent.slice(0, 255),
  });

  // Échec réel (ex: table absente avant migration 0006) → on laisse le
  // fallback SQLite enregistrer la visite en local (utile en dev).
  if (!error) return true;

  // Migration 0031 non appliquée : colonne `source` inconnue → on réessaie
  // sans elle plutôt que de perdre la visite.
  if (/source|column/i.test(error.message || "")) {
    const retry = await supabase.from("site_visits").insert({
      path: pagePath,
      ip_hash: hashIp(ip),
      user_agent: userAgent.slice(0, 255),
    });
    return !retry.error;
  }
  return false;
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
    const pagePath = String(body.path || "/");

    // Ignore admin routes or bots if desired
    if (pagePath.startsWith("/cz7tk")) {
      return NextResponse.json({ tracked: false });
    }

    const userAgent = request.headers.get("user-agent") || "";
    if (/bot|crawl|spider|slurp|lighthouse/i.test(userAgent)) {
      return NextResponse.json({ tracked: false, bot: true });
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

    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";
    // Source de trafic (§23) : utm_source / domaine d'origine / direct.
    const source = normalizeSource(body.source);

    // Supabase (production) → SQLite (local / dev, ex: avant migration 0006)
    if (isSupabaseConfigured()) {
      const ok = await trackInSupabase(pagePath, source, userAgent, ip);
      if (ok) {
        return NextResponse.json({ tracked: true });
      }
      // Fallback : si l'écriture Supabase échoue réellement, on tente SQLite.
      const fallbackOk = trackInSqlite(pagePath, source, userAgent, ip);
      return NextResponse.json({ tracked: fallbackOk });
    }

    const ok = trackInSqlite(pagePath, source, userAgent, ip);
    return NextResponse.json({ tracked: ok });
  } catch (err) {
    return NextResponse.json({ tracked: false, error: String(err) }, { status: 500 });
  }
}

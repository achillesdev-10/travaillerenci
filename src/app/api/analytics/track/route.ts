import { NextResponse } from "next/server";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

const DB_PATH = path.join(process.cwd(), "data", "travaillerenci.sqlite3");

export const dynamic = "force-dynamic";

function ensureTable(db: InstanceType<typeof DatabaseSync>) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS site_visits (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      path TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_visits_created_at ON site_visits (created_at DESC);
  `);
}

function hashIp(ip: string) {
  return Buffer.from(ip).toString("base64").slice(0, 16);
}

/** Écriture locale (SQLite) — utilisée hors production ou en secours. */
function trackInSqlite(pagePath: string, userAgent: string, ip: string) {
  try {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    ensureTable(db);
    db.prepare(
      "INSERT INTO site_visits (path, ip_hash, user_agent) VALUES (?, ?, ?)",
    ).run(pagePath, hashIp(ip), userAgent.slice(0, 255));
    db.close();
    return true;
  } catch {
    return false;
  }
}

/** Écriture Supabase (production, FS en lecture seule). */
async function trackInSupabase(pagePath: string, userAgent: string, ip: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from("site_visits").insert({
    path: pagePath,
    ip_hash: hashIp(ip),
    user_agent: userAgent.slice(0, 255),
  });

  // Échec réel (ex: table absente avant migration 0006) → on laisse le
  // fallback SQLite enregistrer la visite en local (utile en dev).
  return !error;
}

export async function POST(request: Request) {
  try {
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

    const ip = request.headers.get("x-forwarded-for") || "127.0.0.1";

    // Supabase (production) → SQLite (local / dev, ex: avant migration 0006)
    if (isSupabaseConfigured()) {
      const ok = await trackInSupabase(pagePath, userAgent, ip);
      if (ok) {
        return NextResponse.json({ tracked: true });
      }
      // Fallback : si l'écriture Supabase échoue réellement, on tente SQLite.
      const fallbackOk = trackInSqlite(pagePath, userAgent, ip);
      return NextResponse.json({ tracked: fallbackOk });
    }

    const ok = trackInSqlite(pagePath, userAgent, ip);
    return NextResponse.json({ tracked: ok });
  } catch (err) {
    return NextResponse.json({ tracked: false, error: String(err) }, { status: 500 });
  }
}

import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

export type AnalyticsVisitPoint = {
  /** Date ISO (YYYY-MM-DD). */
  date: string;
  label: string;
  visits: number;
};

export type AnalyticsTopPage = {
  path: string;
  visits: number;
  /** Part des visites en % (1 décimale). */
  share: number;
};

export type AnalyticsRecentVisit = {
  path: string;
  createdAt: string | null;
  userAgent: string | null;
  device: string | null;
};

export type AdminAnalyticsData = {
  totalVisits: number;
  visitsToday: number;
  visitsThisWeek: number;
  uniqueVisitors: number;
  visitsByDay: AnalyticsVisitPoint[];
  topPages: AnalyticsTopPage[];
  recentVisits: AnalyticsRecentVisit[];
  /** "sqlite" | "supabase" | "empty" selon la source réelle des données. */
  source: "sqlite" | "supabase" | "empty";
  note: string | null;
};

const DB_PATH = path.join(process.cwd(), "data", "travaillerenci.sqlite3");

function asIsoDate(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toISOString();
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringFromUnknown(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function formatDayLabel(dayKey: string) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}

function emptyAnalytics(note: string): AdminAnalyticsData {
  return {
    totalVisits: 0,
    visitsToday: 0,
    visitsThisWeek: 0,
    uniqueVisitors: 0,
    visitsByDay: [],
    topPages: [],
    recentVisits: [],
    source: "empty",
    note,
  };
}

function buildVisitsByDay(
  rows: Array<{ day: string; total: number }>,
  days: number,
): AnalyticsVisitPoint[] {
  const dayKeys = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - (days - i - 1));
    return d.toISOString().slice(0, 10);
  });

  return dayKeys.map((key) => {
    const row = rows.find((r) => String(r.day) === key);
    return {
      date: key,
      label: formatDayLabel(key),
      visits: row ? numberFromUnknown(row.total) : 0,
    };
  });
}

function normalizePath(rawPath: unknown) {
  const p = stringFromUnknown(rawPath, "/");
  return p.startsWith("/") ? p : `/${p}`;
}

function normalizeDevice(userAgent: string | null) {
  if (!userAgent) return null;
  if (/mobile|iphone|ipad|android/i.test(userAgent)) return "Mobile";
  if (/bot|crawl|spider|slurp|lighthouse/i.test(userAgent)) return "Bot";
  return "Desktop";
}

function fromSqliteRows(
  rows: Record<string, unknown>[],
  days: number,
): AdminAnalyticsData {
  const totalVisits = rows.length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const visitsToday = rows.filter((r) =>
    String(r.created_at ?? "").slice(0, 10) === todayKey,
  ).length;

  const visitsThisWeek = rows.filter((r) => {
    const parsed = new Date(String(r.created_at ?? ""));
    return !Number.isNaN(parsed.getTime()) && parsed.getTime() >= oneWeekAgo;
  }).length;

  const uniqueVisitors = new Set(
    rows.map((r) => String(r.ip_hash ?? "").trim()).filter(Boolean),
  ).size;

  // Regroupement par jour
  const byDayMap = new Map<string, number>();
  for (const row of rows) {
    const day = String(row.created_at ?? "").slice(0, 10);
    if (day) byDayMap.set(day, (byDayMap.get(day) || 0) + 1);
  }
  const visitsByDay = buildVisitsByDay(
    Array.from(byDayMap.entries()).map(([day, total]) => ({ day, total })),
    days,
  );

  // Top pages
  const pageMap = new Map<string, number>();
  for (const row of rows) {
    const p = normalizePath(row.path);
    pageMap.set(p, (pageMap.get(p) || 0) + 1);
  }
  const topPages = Array.from(pageMap.entries())
    .map(([pathName, visits]) => ({ path: pathName, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10)
    .map(({ path: pathName, visits }) => ({
      path: pathName,
      visits,
      share: totalVisits > 0 ? Math.round((visits / totalVisits) * 1000) / 10 : 0,
    }));

  // Dernières visites
  const recentVisits = [...rows]
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))
    .slice(0, 12)
    .map((r) => {
      const agent = stringFromUnknown(r.user_agent, "") || null;
      return {
        path: normalizePath(r.path),
        createdAt: asIsoDate(r.created_at),
        userAgent: agent,
        device: normalizeDevice(agent),
      };
    });

  return {
    totalVisits,
    visitsToday,
    visitsThisWeek,
    uniqueVisitors,
    visitsByDay,
    topPages,
    recentVisits,
    source: "sqlite",
    note: null,
  };
}

async function fromSupabase(days: number): Promise<AdminAnalyticsData> {
  const supabase = getSupabaseClient();
  if (!supabase) return emptyAnalytics("Supabase non configuré.");

  const { data, error, count } = await supabase
    .from("site_visits")
    .select("path,ip_hash,user_agent,created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    return emptyAnalytics(
      /relation|does not exist/i.test(error.message)
        ? "Table site_visits absente côté Supabase (migration 0006 non appliquée)."
        : `Erreur de lecture analytics : ${error.message}`,
    );
  }

  const rows = (data || []).map((row) => ({
    path: stringFromUnknown(row.path, "/"),
    ip_hash: stringFromUnknown(row.ip_hash, ""),
    user_agent: stringFromUnknown(row.user_agent, ""),
    created_at: row.created_at ? String(row.created_at) : "",
  }));

  const result = fromSqliteRows(rows as unknown as Record<string, unknown>[], days);
  return { ...result, totalVisits: count ?? result.totalVisits, source: "supabase" };
}

/**
 * Données analytics pour le dashboard admin.
 * Priorité : Supabase si configuré (production), sinon SQLite local.
 */
export async function getAdminAnalyticsData(
  days = 14,
): Promise<AdminAnalyticsData> {
  if (isSupabaseConfigured()) {
    return fromSupabase(days);
  }

  if (!existsSync(DB_PATH)) {
    return emptyAnalytics("Aucune base locale : les visites seront enregistrées après la première navigation.");
  }

  try {
    const db = new DatabaseSync(DB_PATH);
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'site_visits'",
      )
      .get();

    if (!table) {
      db.close();
      return emptyAnalytics("Table site_visits absente — les visites n'ont pas encore été trackées.");
    }

    const rows = db
      .prepare("SELECT path, ip_hash, user_agent, created_at FROM site_visits")
      .all() as Record<string, unknown>[];
    db.close();

    if (rows.length === 0) {
      return emptyAnalytics("Aucune visite enregistrée pour le moment.");
    }

    return fromSqliteRows(rows, days);
  } catch {
    return emptyAnalytics("Impossible de lire les statistiques de visites.");
  }
}

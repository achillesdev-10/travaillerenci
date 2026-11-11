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
  days: number,
): AdminAnalyticsData {
  const db = new DatabaseSync(DB_PATH);

  const todayKey = new Date().toISOString().slice(0, 10);

  // Visites d'aujourd'hui — agrégat SQL
  const todayRes = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM site_visits WHERE DATE(created_at) = DATE('now')",
    )
    .get() as { cnt: unknown };
  const visitsToday = numberFromUnknown((todayRes as any)?.cnt ?? 0);

  // Visites cette semaine — agrégat SQL
  const weekRes = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM site_visits WHERE created_at >= DATE('now', '-7 days')",
    )
    .get() as { cnt: unknown };
  const visitsThisWeek = numberFromUnknown((weekRes as any)?.cnt ?? 0);

  // Visiteurs uniques — agrégat SQL
  const uniqueRes = db
    .prepare(
      "SELECT COUNT(DISTINCT ip_hash) as cnt FROM site_visits WHERE ip_hash IS NOT NULL AND ip_hash != ''",
    )
    .get() as { cnt: unknown };
  const uniqueVisitors = numberFromUnknown((uniqueRes as any)?.cnt ?? 0);

  // Répartition quotidienne — agrégat SQL
  const byDayRows = db
    .prepare(
      "SELECT DATE(created_at) as day, COUNT(*) as total FROM site_visits GROUP BY DATE(created_at) ORDER BY day",
    )
    .all() as Array<{ day: unknown; total: unknown }>;
  const visitsByDay = buildVisitsByDay(
    byDayRows.map((r) => ({ day: String(r.day), total: numberFromUnknown(r.total) })),
    days,
  );

  // Top pages — agrégat SQL
  const pageRows = db
    .prepare(
      "SELECT path, COUNT(*) as visits FROM site_visits GROUP BY path ORDER BY visits DESC LIMIT 10",
    )
    .all() as Array<{ path: unknown; visits: unknown }>;
  const topPages = pageRows.map(({ path, visits }) => ({
    path: normalizePath(path),
    visits: numberFromUnknown(visits),
    share: 0, // sera recalculée plus bas si nécessaire
  }));

  // Dernières visites — limité à 12 en SQL
  const recentRows = db
    .prepare(
      "SELECT path, ip_hash, user_agent, created_at FROM site_visits ORDER BY created_at DESC LIMIT 12",
    )
    .all() as Record<string, unknown>[];
  const recentVisits = recentRows.map((r) => {
    const agent = stringFromUnknown(r.user_agent, "") || null;
    return {
      path: normalizePath(r.path),
      createdAt: asIsoDate(r.created_at),
      userAgent: agent,
      device: normalizeDevice(agent),
    };
  });

  db.close();
  const totalVisitsRes = db
    .prepare("SELECT COUNT(*) as cnt FROM site_visits")
    .get() as { cnt: unknown };
  const totalVisits = numberFromUnknown(totalVisitsRes.cnt ?? 0);

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

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const windowStart = new Date();
  windowStart.setHours(0, 0, 0, 0);
  windowStart.setDate(windowStart.getDate() - (days - 1));

  // Egress maîtrisé : les compteurs passent par `head: true` (aucune ligne
  // téléchargée) et seules les visites de la fenêtre affichée sont lues.
  const [totalRes, todayRes, weekRes, dailyRes] =
    await Promise.all([
      supabase
        .from("site_visits")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("site_visits")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("site_visits")
        .select("id", { count: "exact", head: true })
        .gte("created_at", weekStart.toISOString()),
      supabase.from("site_visits_daily").select("day,visits"),
    ]);

  if (totalRes.error) {
    return emptyAnalytics(
      /relation|does not exist/i.test(totalRes.error.message)
        ? "Table site_visits absente côté Supabase (migration 0006 non appliquée)."
        : `Erreur de lecture analytics : ${totalRes.error.message}`,
    );
  }

  if (todayRes.error) {
    return emptyAnalytics(
      /relation|does not exist/i.test(todayRes.error.message)
        ? "Table site_visits absente côté Supabase (migration 0006 non appliquée)."
        : `Erreur de lecture analytics : ${todayRes.error.message}`,
    );
  }

  if (weekRes.error) {
    return emptyAnalytics(
      /relation|does not exist/i.test(weekRes.error.message)
        ? "Table site_visits absente côté Supabase (migration 0006 non appliquée)."
        : `Erreur de lecture analytics : ${weekRes.error.message}`,
    );
  }

  // Agrégats quotidiens — depuis la table matérialisée existante
  let aggregatedVisits = 0;
  if (dailyRes.data ?? []) {
    for (const row of dailyRes.data as Array<{ day: string; visits: unknown }>) {
      aggregatedVisits += numberFromUnknown(row.visits);
    }
  }

  // Nombre de visiteurs uniques — agrégat SQL via COUNT(DISTINCT)
  const uniqueRes = await supabase
    .from("site_visits")
    .select("ip_hash", { count: "exact", head: true })
    .gte("created_at", windowStart.toISOString());

  if (uniqueRes.error) {
    return emptyAnalytics(
      /relation|does not exist/i.test(uniqueRes.error.message)
        ? "Table site_visits absente côté Supabase (migration 0006 non appliquée)."
        : `Erreur de lecture analytics : ${uniqueRes.error.message}`,
    );
  }

  // Top pages — agrégat SQL via GROUP BY
  const topPagesRes = await supabase
    .from("site_visits")
    .select("path", { count: "exact", head: false })
    .gte("created_at", windowStart.toISOString())
    .order("path", { ascending: true });

  if (topPagesRes.error) {
    return emptyAnalytics(
      /relation|does not exist/i.test(topPagesRes.error.message)
        ? "Table site_visits absente côté Supabase (migration 0006 non appliquée)."
        : `Erreur de lecture analytics : ${topPagesRes.error.message}`,
    );
  }

  // Récupération des 12 visites récentes (déjà limité à 12)
  const windowRes = await supabase
    .from("site_visits")
    .select("path,ip_hash,user_agent,created_at")
    .gte("created_at", windowStart.toISOString())
    .order("created_at", { ascending: false })
    .limit(12);

  if (windowRes.error) {
    return emptyAnalytics(
      /relation|does not exist/i.test(windowRes.error.message)
        ? "Table site_visits absente côté Supabase (migration 0006 non appliquée)."
        : `Erreur de lecture analytics : ${windowRes.error.message}`,
    );
  }

  const rows = (windowRes.data || []).map((row) => ({
    path: stringFromUnknown(row.path, "/"),
    ip_hash: stringFromUnknown(row.ip_hash, ""),
    created_at: row.created_at ? String(row.created_at) : "",
  }));

  // Top pages à partir des agrégats — recalculer le share avec rowsInWindow
  const pageMap = new Map<string, number>();
  for (const row of rows) {
    const p = normalizePath(row.path);
    pageMap.set(p, (pageMap.get(p) || 0) + 1);
  }
  const rowsInWindow = rows.length;
  const topPages = Array.from(pageMap.entries())
    .map(([pathName, visits]) => ({ path: pathName, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10)
    .map(({ path: pathName, visits }) => ({
      path: pathName,
      visits,
      share:
        rowsInWindow > 0
          ? Math.round((visits / rowsInWindow) * 1000) / 10
          : 0,
    }));

  // Visiteurs uniques depuis l'agrégat
  const uniqueVisitors = numberFromUnknown(uniqueRes.count ?? 0);

  // Visites par jour — depuis la table matérialisée
  const byDayMap = new Map<string, number>();
  if (dailyRes.data ?? []) {
    for (const row of dailyRes.data as Array<{ day: string; visits: number }>) {
      byDayMap.set(String(row.day), numberFromUnknown(row.visits));
    }
  }
  const visitsByDay = buildVisitsByDay(
    Array.from(byDayMap.entries()).map(([day, total]) => ({ day, total })),
    days,
  );

  // Dernières visites
  const recentVisits = (windowRes.data || []).map((row) => {
    const agent = stringFromUnknown(row.user_agent, "") || null;
    return {
      path: normalizePath(row.path),
      createdAt: asIsoDate(row.created_at),
      userAgent: agent,
      device: normalizeDevice(agent),
    };
  });

  return {
    totalVisits: numberFromUnknown(totalRes.count) + aggregatedVisits,
    visitsToday: numberFromUnknown(todayRes.count),
    visitsThisWeek: numberFromUnknown(weekRes.count),
    uniqueVisitors,
    visitsByDay,
    topPages,
    recentVisits,
    source: "supabase",
    note: null,
  };
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

    return fromSqliteRows(days);
  } catch {
    return emptyAnalytics("Impossible de lire les statistiques de visites.");
  }
}

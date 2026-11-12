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

function fromSqliteRows(days: number): AdminAnalyticsData {
  const db = new DatabaseSync(DB_PATH);

  try {
    const table = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'site_visits'",
      )
      .get();

    if (!table) {
      return emptyAnalytics(
        "Table site_visits absente — les visites n'ont pas encore été trackées.",
      );
    }

    // Vérifier si la table matérialisée site_visits_daily existe
    const dailyTableExists = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'site_visits_daily'",
      )
      .get();

    const todayRes = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM site_visits WHERE DATE(created_at) = DATE('now')",
      )
      .get() as { cnt: unknown };
    const visitsToday = numberFromUnknown(todayRes?.cnt ?? 0);

    const weekRes = db
      .prepare(
        "SELECT COUNT(*) as cnt FROM site_visits WHERE created_at >= DATE('now', '-7 days')",
      )
      .get() as { cnt: unknown };
    const visitsThisWeek = numberFromUnknown(weekRes?.cnt ?? 0);

    const uniqueRes = db
      .prepare(
        "SELECT COUNT(DISTINCT ip_hash) as cnt FROM site_visits WHERE ip_hash IS NOT NULL AND ip_hash != ''",
      )
      .get() as { cnt: unknown };
    const uniqueVisitors = numberFromUnknown(uniqueRes?.cnt ?? 0);

    const totalVisitsRes = db
      .prepare("SELECT COUNT(*) as cnt FROM site_visits")
      .get() as { cnt: unknown };
    const totalVisits = numberFromUnknown(totalVisitsRes?.cnt ?? 0);

    // Répartition quotidienne : agrégats historiques + lignes encore présentes.
    let aggregatedVisits = 0;
    const byDayMap = new Map<string, number>();

    if (dailyTableExists) {
      const dailyRes = db
        .prepare("SELECT day, visits FROM site_visits_daily ORDER BY day")
        .all() as Array<{ day: unknown; visits: unknown }>;

      for (const row of dailyRes) {
        const day = String(row.day);
        const visits = numberFromUnknown(row.visits);
        aggregatedVisits += visits;
        byDayMap.set(day, (byDayMap.get(day) ?? 0) + visits);
      }
    }

    const currentByDay = db
      .prepare(
        "SELECT DATE(created_at) as day, COUNT(*) as total FROM site_visits GROUP BY DATE(created_at) ORDER BY day",
      )
      .all() as Array<{ day: unknown; total: unknown }>;

    for (const row of currentByDay) {
      const day = String(row.day);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + numberFromUnknown(row.total));
    }

    const visitsByDay = buildVisitsByDay(
      Array.from(byDayMap.entries()).map(([day, total]) => ({ day, total })),
      days,
    );

    const pageRows = db
      .prepare(
        "SELECT path, COUNT(*) as visits FROM site_visits GROUP BY path ORDER BY visits DESC LIMIT 10",
      )
      .all() as Array<{ path: unknown; visits: unknown }>;

    const topPages = pageRows.map(({ path, visits }) => {
      const count = numberFromUnknown(visits);
      return {
        path: normalizePath(path),
        visits: count,
        share:
          totalVisits > 0
            ? Math.round((count / totalVisits) * 1000) / 10
            : 0,
      };
    });

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

    const grandTotal = totalVisits + aggregatedVisits;
    if (grandTotal === 0) {
      return emptyAnalytics("Aucune visite enregistrée pour le moment.");
    }

    return {
      totalVisits: grandTotal,
      visitsToday,
      visitsThisWeek,
      uniqueVisitors,
      visitsByDay,
      topPages,
      recentVisits,
      source: "sqlite",
      note: null,
    };
  } finally {
    db.close();
  }
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
  const windowStartKey = windowStart.toISOString().slice(0, 10);

  // Egress maîtrisé : les compteurs passent par `head: true` (aucune ligne
  // téléchargée) et une seule requête lit la fenêtre affichée.
  const [totalRes, todayRes, weekRes, dailyRes, windowRes] = await Promise.all([
    supabase.from("site_visits").select("id", { count: "exact", head: true }),
    supabase
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),
    supabase
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart.toISOString()),
    supabase.from("site_visits_daily").select("day,visits"),
    supabase
      .from("site_visits")
      .select("path,ip_hash,user_agent,created_at")
      .gte("created_at", windowStart.toISOString())
      .order("created_at", { ascending: false }),
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

  if (windowRes.error) {
    return emptyAnalytics(
      /relation|does not exist/i.test(windowRes.error.message)
        ? "Table site_visits absente côté Supabase (migration 0006 non appliquée)."
        : `Erreur de lecture analytics : ${windowRes.error.message}`,
    );
  }

  // Les agrégats historiques sont optionnels : leur absence ne doit pas
  // empêcher l'affichage des visites récentes.
  let note: string | null = null;
  if (
    dailyRes.error &&
    !/relation|does not exist/i.test(dailyRes.error.message)
  ) {
    note = `Agrégats historiques indisponibles : ${dailyRes.error.message}`;
  }

  const windowRows = windowRes.data ?? [];
  const rowsInWindow = windowRows.length;

  let aggregatedVisits = 0;
  const byDayMap = new Map<string, number>();
  if (dailyRes.data) {
    for (const row of dailyRes.data as Array<{ day: string; visits: unknown }>) {
      const day = String(row.day);
      const visits = numberFromUnknown(row.visits);
      aggregatedVisits += visits;

      // La fenêtre est lue ligne par ligne ci-dessous : ne pas additionner
      // deux fois les jours déjà couverts par cette lecture.
      if (day < windowStartKey) {
        byDayMap.set(day, (byDayMap.get(day) ?? 0) + visits);
      }
    }
  }

  const uniqueSet = new Set<string>();
  const pageMap = new Map<string, number>();

  for (const row of windowRows) {
    const ip = stringFromUnknown(row.ip_hash, "");
    if (ip) uniqueSet.add(ip);

    const p = normalizePath(row.path);
    pageMap.set(p, (pageMap.get(p) ?? 0) + 1);

    if (row.created_at) {
      const day = String(row.created_at).slice(0, 10);
      byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
    }
  }

  const uniqueVisitors = uniqueSet.size;

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

  const visitsByDay = buildVisitsByDay(
    Array.from(byDayMap.entries()).map(([day, total]) => ({ day, total })),
    days,
  );

  const recentVisits = windowRows.slice(0, 12).map((row) => {
    const agent = stringFromUnknown(row.user_agent, "") || null;
    return {
      path: normalizePath(row.path),
      createdAt: asIsoDate(row.created_at),
      userAgent: agent,
      device: normalizeDevice(agent),
    };
  });

  const totalVisits = numberFromUnknown(totalRes.count) + aggregatedVisits;
  if (totalVisits === 0) {
    return emptyAnalytics("Aucune visite enregistrée pour le moment.");
  }

  return {
    totalVisits,
    visitsToday: numberFromUnknown(todayRes.count),
    visitsThisWeek: numberFromUnknown(weekRes.count),
    uniqueVisitors,
    visitsByDay,
    topPages,
    recentVisits,
    source: "supabase",
    note,
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
    return fromSqliteRows(days);
  } catch {
    return emptyAnalytics("Impossible de lire les statistiques de visites.");
  }
}

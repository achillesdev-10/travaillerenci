import { existsSync, mkdirSync, readFileSync, writeFileSync, openSync, closeSync } from "node:fs";
import path from "node:path";
import { spawn, execSync } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase";

export type DashboardOffer = {
  id: string;
  title: string;
  company: string;
  city: string;
  status: "En attente" | "Vérifiées" | "Expirées";
  /** Date limite de candidature (ISO) — null si inconnue. */
  deadline: string | null;
  sourceUrl: string;
  createdAt: string | null;
  clicks: number;
};

export type DashboardStats = {
  totalActiveOffers: number;
  newOffersThisWeek: number;
  totalClicks: number;
  totalVisits: number;
  visitsToday: number;
  visitsThisWeek: number;
};

export type ScraperHealth = {
  status: "idle" | "running" | "success" | "error";
  lastRunAt: string | null;
  offersAdded: number | null;
  message: string | null;
};

/** Stats de santé par source scraper (historique 30 jours). */
export type SourceHealthStats = {
  latest_collected: number;
  latest_published: number;
  latest_errors: number;
  latest_duration: number;
  latest_timestamp: string;
  threshold_ok: boolean;
  average_collected: number | null;
  success_rate: number;
  runs_tracked: number;
};

export type AdminDashboardData = {
  offers: DashboardOffer[];
  cities: string[];
  stats: DashboardStats;
  scraperHealth: ScraperHealth;
  sourceHealth: Record<string, SourceHealthStats>;
};

export type BulkAction = "delete" | "verify" | "archive";

type SqliteDb = InstanceType<typeof DatabaseSync>;
type SqliteRow = Record<string, unknown>;

const DB_PATH = path.join(process.cwd(), "data", "travaillerenci.sqlite3");
const SCRAPER_HEALTH_PATH = path.join(
  process.cwd(),
  "data",
  "admin-scraper-health.json",
);
const SOURCE_HEALTH_PATH = path.join(
  process.cwd(),
  "data",
  "source-health.json",
);

let inMemoryScraperHealth: ScraperHealth | null = null;

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

function openDatabase(): SqliteDb | null {
  if (!existsSync(DB_PATH)) {
    return null;
  }

  const db = new DatabaseSync(DB_PATH);

  // Auto-guérison : un ancien trigger AFTER UPDATE (récursion infinie en
  // SQLite) bloquait toutes les écritures. On ne le supprime que s'il existe
  // réellement pour éviter une écriture inutile à chaque ouverture.
  try {
    const trigger = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'trigger' AND name = 'trigger_jobs_set_updated_at'",
      )
      .get();
    if (trigger) {
      db.exec("DROP TRIGGER trigger_jobs_set_updated_at;");
    }
  } catch {
    // BDD verrouillée / en lecture seule : on laisse le fix suivant s'en charger.
  }

  return db;
}

function getTableNames(db: SqliteDb) {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = ? ORDER BY name")
    .all("table") as Array<{ name: string }>;

  return new Set(rows.map((row) => String(row.name)));
}

function getTableColumns(db: SqliteDb, tableName: string) {
  const rows = db
    .prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`)
    .all() as Array<{ name: string }>;

  return new Set(rows.map((row) => String(row.name)));
}

function pickFirstAvailable(columns: Set<string>, candidates: string[]) {
  return candidates.find((candidate) => columns.has(candidate)) ?? null;
}

function findExistingTable(tables: Set<string>, candidates: string[]) {
  return candidates.find((candidate) => tables.has(candidate)) ?? null;
}

function asIsoDate(value: unknown) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(String(value));

  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return parsed.toISOString();
}

function normaliseStatus(rawStatus: unknown, archived = false) {
  if (archived) {
    return "Expirées" as const;
  }

  const value = String(rawStatus ?? "").trim().toLowerCase();

  if (!value) {
    return "En attente" as const;
  }

  if (
    value.includes("verif") ||
    value.includes("approved") ||
    value.includes("valid") ||
    value.includes("publish")
  ) {
    return "Vérifiées" as const;
  }

  if (
    value.includes("expir") ||
    value.includes("archiv") ||
    value.includes("closed")
  ) {
    return "Expirées" as const;
  }

  return "En attente" as const;
}

function normaliseRunStatus(rawStatus: unknown) {
  const value = String(rawStatus ?? "").trim().toLowerCase();

  if (!value) {
    return "idle" as const;
  }

  if (
    value === "1" ||
    value === "true" ||
    value.includes("success") ||
    value.includes("succ") ||
    value.includes("done") ||
    value.includes("ok")
  ) {
    return "success" as const;
  }

  if (value.includes("run") || value.includes("progress") || value.includes("pend")) {
    return "running" as const;
  }

  if (value.includes("error") || value.includes("fail") || value.includes("ko")) {
    return "error" as const;
  }

  return "idle" as const;
}

function numberFromUnknown(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function stringFromUnknown(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function getOfferRows(db: SqliteDb) {
  const tables = getTableNames(db);
  const offerTable = findExistingTable(tables, ["job_offers", "jobs", "offers"]);

  if (!offerTable) {
    return [];
  }

  const columns = getTableColumns(db, offerTable);
  const idColumn = pickFirstAvailable(columns, ["id"]);

  if (!idColumn) {
    return [];
  }

  const titleColumn = pickFirstAvailable(columns, [
    "title",
    "job_title",
    "poste",
  ]);
  const companyColumn = pickFirstAvailable(columns, [
    "company",
    "company_name",
    "employer",
  ]);
  const cityColumn = pickFirstAvailable(columns, [
    "city",
    "location",
    "commune",
    "address",
  ]);
  const statusColumn = pickFirstAvailable(columns, ["status", "state"]);
  const deadlineColumn = pickFirstAvailable(columns, [
    "deadline",
    "expires_at",
    "apply_deadline",
  ]);
  const sourceUrlColumn = pickFirstAvailable(columns, [
    "source_url",
    "url",
    "link",
  ]);
  const createdAtColumn = pickFirstAvailable(columns, [
    "created_at",
    "createdAt",
    "published_at",
    "inserted_at",
    "date_posted",
  ]);
  const clicksColumn = pickFirstAvailable(columns, [
    "clicks",
    "clicks_count",
    "click_count",
    "total_clicks",
    "views",
  ]);
  const archivedFlagColumn = pickFirstAvailable(columns, [
    "is_archived",
    "archived",
  ]);
  const archivedAtColumn = pickFirstAvailable(columns, ["archived_at"]);

  const selectedColumns = [
    `${quoteIdentifier(idColumn)} AS id`,
    titleColumn
      ? `${quoteIdentifier(titleColumn)} AS title`
      : `'' AS title`,
    companyColumn
      ? `${quoteIdentifier(companyColumn)} AS company`
      : `'' AS company`,
    cityColumn ? `${quoteIdentifier(cityColumn)} AS city` : `'' AS city`,
    statusColumn
      ? `${quoteIdentifier(statusColumn)} AS status`
      : `'' AS status`,
    sourceUrlColumn
      ? `${quoteIdentifier(sourceUrlColumn)} AS "sourceUrl"`
      : `'' AS "sourceUrl"`,
    deadlineColumn
      ? `${quoteIdentifier(deadlineColumn)} AS deadline`
      : `NULL AS deadline`,
    createdAtColumn
      ? `${quoteIdentifier(createdAtColumn)} AS "createdAt"`
      : `NULL AS "createdAt"`,
    clicksColumn ? `${quoteIdentifier(clicksColumn)} AS clicks` : `0 AS clicks`,
    archivedFlagColumn
      ? `${quoteIdentifier(archivedFlagColumn)} AS "archivedFlag"`
      : `0 AS "archivedFlag"`,
    archivedAtColumn
      ? `${quoteIdentifier(archivedAtColumn)} AS "archivedAt"`
      : `NULL AS "archivedAt"`,
  ];

  const orderBy = createdAtColumn
    ? `${quoteIdentifier(createdAtColumn)} DESC`
    : `${quoteIdentifier(idColumn)} DESC`;

  const rows = db
    .prepare(
      `SELECT ${selectedColumns.join(", ")} FROM ${quoteIdentifier(offerTable)} ORDER BY ${orderBy}`,
    )
    .all() as SqliteRow[];

  return rows.map((row) => {
    const archived =
      Boolean(row.archivedFlag) || row.archivedAt !== null && row.archivedAt !== undefined;
    const deadline = asIsoDate(row.deadline);

    // Expiration automatique par date limite : une offre dont la deadline est
    // passée est affichée « Expirées » quel que soit son statut de modération.
    const status: DashboardOffer["status"] = (() => {
      const base = normaliseStatus(row.status, archived);
      if (
        base !== "Expirées" &&
        deadline &&
        !Number.isNaN(new Date(deadline).getTime()) &&
        new Date(deadline).getTime() < Date.now()
      ) {
        return "Expirées";
      }
      return base;
    })();

    return {
      id: String(row.id),
      title: stringFromUnknown(row.title, "Titre indisponible"),
      company: stringFromUnknown(row.company, "Entreprise indisponible"),
      city: stringFromUnknown(row.city, "Non renseignée"),
      status,
      deadline,
      sourceUrl: stringFromUnknown(row.sourceUrl, ""),
      createdAt: asIsoDate(row.createdAt),
      clicks: numberFromUnknown(row.clicks),
    } satisfies DashboardOffer;
  });
}

function getFallbackClicksFromStatsTables(db: SqliteDb) {
  const tables = getTableNames(db);

  if (tables.has("page_views")) {
    const columns = getTableColumns(db, "page_views");
    const counterColumn = pickFirstAvailable(columns, [
      "clicks",
      "count",
      "view_count",
      "total_clicks",
    ]);

    if (counterColumn) {
      const row = db
        .prepare(
          `SELECT COALESCE(SUM(${quoteIdentifier(counterColumn)}), 0) AS total FROM ${quoteIdentifier("page_views")}`,
        )
        .get() as { total?: number } | undefined;

      return numberFromUnknown(row?.total);
    }

    const row = db
      .prepare(`SELECT COUNT(*) AS total FROM ${quoteIdentifier("page_views")}`)
      .get() as { total?: number } | undefined;

    return numberFromUnknown(row?.total);
  }

  if (tables.has("site_stats")) {
    const columns = getTableColumns(db, "site_stats");
    const counterColumn = pickFirstAvailable(columns, [
      "total_clicks",
      "clicks",
      "page_views",
      "visits",
    ]);

    if (counterColumn) {
      const row = db
        .prepare(
          `SELECT COALESCE(MAX(${quoteIdentifier(counterColumn)}), 0) AS total FROM ${quoteIdentifier("site_stats")}`,
        )
        .get() as { total?: number } | undefined;

      return numberFromUnknown(row?.total);
    }
  }

  return 0;
}

function readStoredScraperHealth(): ScraperHealth {
  if (inMemoryScraperHealth) {
    // Protection anti-blocage : si le statut en mémoire est "running" depuis
    // plus de 30 minutes, on considère que c'est un run orphelin (process
    // tué sans avoir écrit sa terminaison) et on force une relecture disque.
    if (inMemoryScraperHealth.status === "running" && inMemoryScraperHealth.lastRunAt) {
      const ageMs = Date.now() - new Date(inMemoryScraperHealth.lastRunAt).getTime();
      if (ageMs > 30 * 60 * 1000) {
        inMemoryScraperHealth = null;
      }
    } else {
      return inMemoryScraperHealth;
    }
  }

  if (!existsSync(SCRAPER_HEALTH_PATH)) {
    return {
      status: "idle",
      lastRunAt: null,
      offersAdded: null,
      message: "Aucune exécution enregistrée pour le moment.",
    };
  }

  try {
    const parsed = JSON.parse(readFileSync(SCRAPER_HEALTH_PATH, "utf8")) as Partial<ScraperHealth>;

    // Même logique de timeout sur la valeur lue du fichier.
    const status = normaliseRunStatus(parsed.status);
    const lastRunAt = parsed.lastRunAt ? String(parsed.lastRunAt) : null;
    const offersAdded =
      parsed.offersAdded === null || parsed.offersAdded === undefined
        ? null
        : numberFromUnknown(parsed.offersAdded);
    const message = parsed.message ? String(parsed.message) : null;

    if (status === "running" && lastRunAt) {
      const ageMs = Date.now() - new Date(lastRunAt).getTime();
      if (ageMs > 30 * 60 * 1000) {
        return {
          status: "error",
          lastRunAt,
          offersAdded,
          message: `Run orphelin détecté (${Math.floor(ageMs / 60000)} min). Consultez data/scraper-last-run.log.`,
        };
      }
    }

    inMemoryScraperHealth = { status, lastRunAt, offersAdded, message };
    return inMemoryScraperHealth;
  } catch {
    return {
      status: "error",
      lastRunAt: null,
      offersAdded: null,
      message: "Impossible de lire l'état du scraper.",
    };
  }
}

function readSourceHealth(): Record<string, SourceHealthStats> {
  if (!existsSync(SOURCE_HEALTH_PATH)) {
    return {};
  }
  try {
    const raw = JSON.parse(readFileSync(SOURCE_HEALTH_PATH, "utf8"));
    if (!raw || typeof raw !== "object") return {};
    const result: Record<string, SourceHealthStats> = {};
    for (const [source, runs] of Object.entries(raw)) {
      if (!Array.isArray(runs) || runs.length === 0) continue;
      const latest = runs[runs.length - 1] as Record<string, unknown>;
      // Calcul de la moyenne (exclut le dernier run)
      const prevRuns = runs.slice(0, -1);
      const avg = prevRuns.length > 0
        ? prevRuns.reduce((sum: number, r: Record<string, unknown>) => sum + numberFromUnknown(r.collected), 0) / prevRuns.length
        : null;
      // Taux de succès
      const successes = runs.filter((r: Record<string, unknown>) => numberFromUnknown(r.errors) === 0).length;
      result[source] = {
        latest_collected: numberFromUnknown(latest.collected),
        latest_published: numberFromUnknown(latest.published),
        latest_errors: numberFromUnknown(latest.errors),
        latest_duration: numberFromUnknown(latest.duration_seconds),
        latest_timestamp: String(latest.timestamp || ""),
        threshold_ok: latest.threshold_ok !== false,
        average_collected: avg !== null ? Math.round(avg * 10) / 10 : null,
        success_rate: runs.length > 0 ? Math.round((successes / runs.length) * 100) / 100 : 1,
        runs_tracked: runs.length,
      };
    }
    return result;
  } catch {
    return {};
  }
}

function writeStoredScraperHealth(scraperHealth: ScraperHealth) {
  inMemoryScraperHealth = scraperHealth;
  try {
    mkdirSync(path.dirname(SCRAPER_HEALTH_PATH), { recursive: true });
    writeFileSync(SCRAPER_HEALTH_PATH, JSON.stringify(scraperHealth, null, 2), "utf8");
  } catch {
    // Ignore EROFS read-only filesystem errors in serverless/production
  }
}

function getScraperHealthFromDatabase(db: SqliteDb): ScraperHealth | null {
  const tables = getTableNames(db);
  const scraperTable = findExistingTable(tables, [
    "scraper_logs",
    "scraper_runs",
    "scrape_runs",
    "scraper_health",
    "scrape_history",
  ]);

  if (!scraperTable) {
    return null;
  }

  const columns = getTableColumns(db, scraperTable);
  const statusColumn = pickFirstAvailable(columns, [
    "status",
    "result",
    "state",
    "success",
  ]);
  const addedColumn = pickFirstAvailable(columns, [
    "offers_added",
    "added_count",
    "jobs_added",
    "new_offers",
  ]);
  const messageColumn = pickFirstAvailable(columns, [
    "message",
    "error",
    "details",
  ]);
  const timestampColumn = pickFirstAvailable(columns, [
    "started_at",
    "finished_at",
    "executed_at",
    "run_at",
    "created_at",
    "updated_at",
  ]);
  const idColumn = pickFirstAvailable(columns, ["id"]);

  const selectedColumns = [
    statusColumn
      ? `${quoteIdentifier(statusColumn)} AS status`
      : `'' AS status`,
    addedColumn
      ? `${quoteIdentifier(addedColumn)} AS "offersAdded"`
      : `NULL AS "offersAdded"`,
    messageColumn
      ? `${quoteIdentifier(messageColumn)} AS message`
      : `NULL AS message`,
    timestampColumn
      ? `${quoteIdentifier(timestampColumn)} AS "lastRunAt"`
      : `NULL AS "lastRunAt"`,
  ];

  const orderBy = timestampColumn
    ? `${quoteIdentifier(timestampColumn)} DESC`
    : idColumn
      ? `${quoteIdentifier(idColumn)} DESC`
      : "rowid DESC";

  const row = db
    .prepare(
      `SELECT ${selectedColumns.join(", ")} FROM ${quoteIdentifier(scraperTable)} ORDER BY ${orderBy} LIMIT 1`,
    )
    .get() as SqliteRow | undefined;

  if (!row) {
    return null;
  }

  return {
    status: normaliseRunStatus(row.status),
    lastRunAt: asIsoDate(row.lastRunAt),
    offersAdded:
      row.offersAdded === null || row.offersAdded === undefined
        ? null
        : numberFromUnknown(row.offersAdded),
    message: row.message ? String(row.message) : null,
  };
}

export type ScraperRunRecord = {
  status: ScraperHealth["status"];
  lastRunAt: string | null;
  offersAdded: number | null;
  message: string | null;
};

/**
 * Historique des exécutions du scraper (table scraper_logs / scraper_runs / …).
 * Trié du plus récent au plus ancien, limité à `limit` entrées.
 */
export async function getScraperRunHistory(limit = 10): Promise<ScraperRunRecord[]> {
  const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
  if (supabase) {
    const { data, error } = await supabase
      .from("scraper_logs")
      .select("id,status,offers_added,message,started_at,finished_at")
      .order("started_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 50));
    if (error) return [];
    return (data || []).map((row) => ({
      status: normaliseRunStatus(row.status),
      lastRunAt: asIsoDate(row.started_at ?? row.finished_at),
      offersAdded:
        row.offers_added === null || row.offers_added === undefined
          ? null
          : numberFromUnknown(row.offers_added),
      message: row.message ? String(row.message) : null,
    }));
  }

  const db = openDatabase();
  if (!db) {
    return [];
  }

  try {
    const tables = getTableNames(db);
    const scraperTable = findExistingTable(tables, [
      "scraper_logs",
      "scraper_runs",
      "scrape_runs",
      "scraper_health",
      "scrape_history",
    ]);

    if (!scraperTable) {
      return [];
    }

    const columns = getTableColumns(db, scraperTable);
    const statusColumn = pickFirstAvailable(columns, [
      "status",
      "result",
      "state",
      "success",
    ]);
    const addedColumn = pickFirstAvailable(columns, [
      "offers_added",
      "added_count",
      "jobs_added",
      "new_offers",
    ]);
    const messageColumn = pickFirstAvailable(columns, [
      "message",
      "error",
      "details",
    ]);
    const timestampColumn = pickFirstAvailable(columns, [
      "started_at",
      "finished_at",
      "executed_at",
      "run_at",
      "created_at",
      "updated_at",
    ]);

    const selectedColumns = [
      statusColumn
        ? `${quoteIdentifier(statusColumn)} AS status`
        : `'' AS status`,
      addedColumn
        ? `${quoteIdentifier(addedColumn)} AS "offersAdded"`
        : `NULL AS "offersAdded"`,
      messageColumn
        ? `${quoteIdentifier(messageColumn)} AS message`
        : `NULL AS message`,
      timestampColumn
        ? `${quoteIdentifier(timestampColumn)} AS "lastRunAt"`
        : `NULL AS "lastRunAt"`,
    ];

    const orderBy = timestampColumn
      ? `${quoteIdentifier(timestampColumn)} DESC`
      : "rowid DESC";

    const rows = db
      .prepare(
        `SELECT ${selectedColumns.join(", ")} FROM ${quoteIdentifier(scraperTable)} ORDER BY ${orderBy} LIMIT $limit`,
      )
      .all({ $limit: Math.min(Math.max(limit, 1), 50) }) as SqliteRow[];

    return rows.map((row) => ({
      status: normaliseRunStatus(row.status),
      lastRunAt: asIsoDate(row.lastRunAt),
      offersAdded:
        row.offersAdded === null || row.offersAdded === undefined
          ? null
          : numberFromUnknown(row.offersAdded),
      message: row.message ? String(row.message) : null,
    }));
  } catch {
    return [];
  }
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
  if (supabase) {
    return getAdminDashboardDataFromSupabase(supabase);
  }

  const db = openDatabase();

  // Expiration automatique (SQLite) : les offres dont la date limite est
  // dépassée passent en is_expired=1 / status='archived' — même si le scraper
  // n'a pas encore tourné.
  if (db) {
    try {
      const tables = getTableNames(db);
      if (tables.has("job_offers")) {
        const cols = getTableColumns(db, "job_offers");
        if (cols.has("deadline") && cols.has("is_expired") && cols.has("status")) {
          db.prepare(
            `UPDATE "job_offers"
             SET is_expired = 1, status = 'archived', updated_at = ?
             WHERE deadline IS NOT NULL AND deadline < ?
               AND status IN ('pending','published')`,
          ).run(new Date().toISOString(), new Date().toISOString());
        }
      }
    } catch {
      // BDD verrouillée / lecture seule : l'expiration se fera au prochain run.
    }
  }

  // Publication automatique (21 min) : si l'admin ne s'est pas connecté, les
  // offres en attente depuis plus de 21 minutes sont validées et publiées.
  // Suppression automatique (21 jours) : les offres âgées de plus de 21 jours
  // (deadline passée ou absente) sont purgées de la base.
  if (db) {
    try {
      const tables = getTableNames(db);
      if (tables.has("job_offers")) {
        const cols = getTableColumns(db, "job_offers");
        const nowIso = new Date().toISOString();
        if (cols.has("status") && cols.has("is_verified") && cols.has("created_at")) {
          const autoPublishCutoff = new Date(Date.now() - 21 * 60 * 1000).toISOString();
          db.prepare(
            `UPDATE "job_offers"
             SET status = 'published', is_verified = 1, updated_at = ?
             WHERE status = 'pending' AND created_at < ?`,
          ).run(nowIso, autoPublishCutoff);
        }
        if (cols.has("created_at") && cols.has("deadline")) {
          const purgeCutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
          db.prepare(
            `DELETE FROM "job_offers"
             WHERE created_at < ? AND (deadline IS NULL OR deadline < ?)`,
          ).run(purgeCutoff, nowIso);
        }
      }
    } catch {
      // BDD verrouillée / lecture seule : la maintenance se fera au prochain run.
    }
  }

  const offers = db ? getOfferRows(db) : [];
  const cities = Array.from(
    new Set(
      offers
        .map((offer) => offer.city)
        .filter((city) => city && city !== "Non renseignée"),
    ),
  ).sort((left, right) => left.localeCompare(right, "fr"));

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const totalClicks = offers.reduce((sum, offer) => sum + offer.clicks, 0);

  let totalVisits = 0;
  let visitsToday = 0;
  let visitsThisWeek = 0;

  if (db) {
    try {
      const tables = getTableNames(db);
      if (tables.has("site_visits")) {
        const totalRow = db.prepare("SELECT COUNT(*) AS c FROM site_visits").get() as { c: number };
        totalVisits = numberFromUnknown(totalRow?.c);

        const todayRow = db.prepare("SELECT COUNT(*) AS c FROM site_visits WHERE date(created_at) = date('now')").get() as { c: number };
        visitsToday = numberFromUnknown(todayRow?.c);

        const weekRow = db.prepare("SELECT COUNT(*) AS c FROM site_visits WHERE datetime(created_at) >= datetime('now', '-7 days')").get() as { c: number };
        visitsThisWeek = numberFromUnknown(weekRow?.c);
      }
    } catch {}
  }

  // Statistiques honnêtes : 0 tant que la table de mesure n'existe pas.
  // (Avant, on affichait des valeurs fictives 1240/85/430 — supprimées.)
  const stats: DashboardStats = {
    totalActiveOffers: offers.filter((offer) => offer.status !== "Expirées").length,
    newOffersThisWeek: offers.filter((offer) => {
      if (!offer.createdAt) {
        return false;
      }

      const parsed = new Date(offer.createdAt).getTime();
      return Number.isFinite(parsed) && parsed >= oneWeekAgo;
    }).length,
    totalClicks: totalClicks || (db ? getFallbackClicksFromStatsTables(db) : 0),
    totalVisits: totalVisits || 0,
    visitsToday: visitsToday || 0,
    visitsThisWeek: visitsThisWeek || 0,
  };

  const scraperHealth = db
    ? getScraperHealthFromDatabase(db) ?? readStoredScraperHealth()
    : readStoredScraperHealth();

  const sourceHealth = readSourceHealth();

  return {
    offers,
    cities,
    stats,
    scraperHealth,
    sourceHealth,
  };
}

function getOfferTableMeta(db: SqliteDb) {
  const tables = getTableNames(db);
  const offerTable = findExistingTable(tables, ["job_offers", "jobs", "offers"]);

  if (!offerTable) {
    return null;
  }

  const columns = getTableColumns(db, offerTable);
  const idColumn = pickFirstAvailable(columns, ["id"]);

  if (!idColumn) {
    return null;
  }

  return {
    offerTable,
    columns,
    idColumn,
  };
}

export async function applyBulkAction(action: BulkAction, ids: string[]): Promise<{ updated: number }> {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id).trim()).filter(Boolean)));

  if (uniqueIds.length === 0) {
    return { updated: 0 };
  }

  const supabase = isSupabaseConfigured() ? getSupabaseClient() : null;
  if (supabase) {
    return applyBulkActionFromSupabase(supabase, action, uniqueIds);
  }

  const db = openDatabase();

  if (!db) {
    throw new Error("Base SQLite introuvable.");
  }

  const meta = getOfferTableMeta(db);

  if (!meta) {
    throw new Error("Table des offres introuvable.");
  }

  const placeholders = uniqueIds.map(() => "?").join(", ");
  const tableName = quoteIdentifier(meta.offerTable);
  const idColumn = quoteIdentifier(meta.idColumn);

  if (action === "delete") {
    const statement = db.prepare(
      `DELETE FROM ${tableName} WHERE ${idColumn} IN (${placeholders})`,
    );
    const result = statement.run(...uniqueIds) as { changes?: number };
    return { updated: numberFromUnknown(result.changes) };
  }

  // Schéma "strict" (job_offers) : status codifié + flags is_verified/is_archived.
  // Schéma "libre" (jobs/offers) : colonne status en texte libre.
  const isStrictSchema =
    meta.columns.has("is_verified") && meta.columns.has("is_archived");

  if (action === "verify") {
    const statusColumn = pickFirstAvailable(meta.columns, ["status", "state"]);
    const verifiedColumn = pickFirstAvailable(meta.columns, ["is_verified"]);

    if (!statusColumn && !verifiedColumn) {
      throw new Error("La colonne de statut est introuvable.");
    }

    const assignments: string[] = [];
    const values: Array<string | number> = [];
    if (verifiedColumn) {
      assignments.push(`${quoteIdentifier(verifiedColumn)} = ?`);
      values.push(1);
    }
    if (statusColumn) {
      assignments.push(`${quoteIdentifier(statusColumn)} = ?`);
      values.push(isStrictSchema ? "published" : "Vérifiées");
    }

    const statement = db.prepare(
      `UPDATE ${tableName} SET ${assignments.join(", ")} WHERE ${idColumn} IN (${placeholders})`,
    );
    const result = statement.run(...values, ...uniqueIds) as { changes?: number };
    return { updated: numberFromUnknown(result.changes) };
  }

  const archivedFlagColumn = pickFirstAvailable(meta.columns, ["is_archived", "archived"]);
  const archivedAtColumn = pickFirstAvailable(meta.columns, ["archived_at"]);
  const expiredColumn = pickFirstAvailable(meta.columns, ["is_expired"]);
  const statusColumn = pickFirstAvailable(meta.columns, ["status", "state"]);

  if (archivedFlagColumn || archivedAtColumn) {
    const assignments: string[] = [];
    const values: Array<string | number> = [];

    if (archivedFlagColumn) {
      assignments.push(`${quoteIdentifier(archivedFlagColumn)} = ?`);
      values.push(1);
    }
    if (expiredColumn) {
      assignments.push(`${quoteIdentifier(expiredColumn)} = ?`);
      values.push(1);
    }
    if (archivedAtColumn) {
      assignments.push(`${quoteIdentifier(archivedAtColumn)} = ?`);
      values.push(new Date().toISOString());
    }
    if (statusColumn) {
      assignments.push(`${quoteIdentifier(statusColumn)} = ?`);
      values.push(isStrictSchema ? "archived" : "Expirées");
    }

    const statement = db.prepare(
      `UPDATE ${tableName} SET ${assignments.join(", ")} WHERE ${idColumn} IN (${placeholders})`,
    );
    const result = statement.run(...values, ...uniqueIds) as { changes?: number };
    return { updated: numberFromUnknown(result.changes) };
  }

  if (statusColumn) {
    const statement = db.prepare(
      `UPDATE ${tableName} SET ${quoteIdentifier(statusColumn)} = ? WHERE ${idColumn} IN (${placeholders})`,
    );
    const result = statement.run(
      isStrictSchema ? "archived" : "Expirées",
      ...uniqueIds,
    ) as { changes?: number };
    return { updated: numberFromUnknown(result.changes) };
  }

  throw new Error("Impossible d'archiver les offres avec le schéma actuel.");
}

/** Variante Supabase : lit les offres + stats pour la vue d'ensemble. */
async function getAdminDashboardDataFromSupabase(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
): Promise<AdminDashboardData> {
  // Expiration automatique (Supabase) : idem SQLite, sans faire échouer le
  // dashboard si la colonne `deadline` n'est pas encore migrée.
  try {
    await supabase
      .from("job_offers")
      .update({ is_expired: true, status: "archived" })
      .lt("deadline", new Date().toISOString())
      .in("status", ["pending", "published"]);
  } catch {
    // migration non appliquée → l'expiration se fera côté SQLite/scraper
  }

  // Publication automatique (21 min) : les offres en attente depuis plus de
  // 21 minutes sont validées et publiées quand l'admin n'intervient pas.
  try {
    const autoPublishCutoff = new Date(Date.now() - 21 * 60 * 1000).toISOString();
    await supabase
      .from("job_offers")
      .update({ status: "published", is_verified: true })
      .eq("status", "pending")
      .lt("created_at", autoPublishCutoff);
  } catch {
    // colonne non migrée → sans effet
  }

  // Suppression automatique (21 jours) : les offres de plus de 21 jours avec
  // deadline passée ou absente sont purgées. Deux requêtes pour éviter les
  // pièges d'encodage des dates dans `.or()`.
  try {
    const nowIso = new Date().toISOString();
    const purgeCutoff = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from("job_offers")
      .delete()
      .lt("created_at", purgeCutoff)
      .is("deadline", null);
    await supabase
      .from("job_offers")
      .delete()
      .lt("created_at", purgeCutoff)
      .lt("deadline", nowIso);
  } catch {
    // colonne non migrée → sans effet
  }

  // Sélection avec `deadline` ; repli automatique si la migration 0005 n'a
  // pas encore été appliquée sur l'instance Supabase.
  const baseSelect =
    "id,title,company,location,status,source_url,created_at,clicks_count,is_archived";
  let { data, error } = await supabase
    .from("job_offers")
    .select(`${baseSelect},deadline`);
  if (error && /deadline/i.test(error.message)) {
    ({ data, error } = await supabase.from("job_offers").select(baseSelect));
  }

  if (error) {
    return {
      offers: [],
      cities: [],
      stats: {
        totalActiveOffers: 0,
        newOffersThisWeek: 0,
        totalClicks: 0,
        totalVisits: 0,
        visitsToday: 0,
        visitsThisWeek: 0,
      },
      scraperHealth: {
        status: "error",
        lastRunAt: null,
        offersAdded: null,
        message: "Impossible de lire les offres (Supabase).",
      },
      sourceHealth: {},
    };
  }

  const rows = data || [];
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const offers: DashboardOffer[] = rows.map((row) => {
    const deadline = asIsoDate(row.deadline);
    const status: DashboardOffer["status"] = (() => {
      const base = normaliseStatus(row.status, Boolean(row.is_archived));
      if (
        base !== "Expirées" &&
        deadline &&
        !Number.isNaN(new Date(deadline).getTime()) &&
        new Date(deadline).getTime() < Date.now()
      ) {
        return "Expirées";
      }
      return base;
    })();
    return {
      id: String(row.id),
      title: stringFromUnknown(row.title, "Titre indisponible"),
      company: stringFromUnknown(row.company, "Entreprise indisponible"),
      city: stringFromUnknown(row.location, "Non renseignée"),
      status,
      deadline,
      sourceUrl: stringFromUnknown(row.source_url, ""),
      createdAt: asIsoDate(row.created_at),
      clicks: numberFromUnknown(row.clicks_count),
    };
  });

  const cities = Array.from(
    new Set(
      offers
        .map((offer) => offer.city)
        .filter((city) => city && city !== "Non renseignée"),
    ),
  ).sort((left, right) => left.localeCompare(right, "fr"));

  const totalClicks = offers.reduce((sum, offer) => sum + offer.clicks, 0);

  // Visites réelles (table site_visits, migration 0006) : comptées depuis
  // Supabase comme pour la page /admin/analytics. Retourne 0 uniquement si
  // la table est absente (migration non appliquée) — jamais de valeurs fictives.
  let totalVisits = 0;
  let visitsToday = 0;
  let visitsThisWeek = 0;
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [{ count: total }, { count: today }, { count: week }] = await Promise.all([
      supabase.from("site_visits").select("id", { count: "exact" }),
      supabase
        .from("site_visits")
        .select("id", { count: "exact" })
        .gte("created_at", todayStart.toISOString()),
      supabase
        .from("site_visits")
        .select("id", { count: "exact" })
        .gte("created_at", weekStart.toISOString()),
    ]);

    totalVisits = numberFromUnknown(total);
    visitsToday = numberFromUnknown(today);
    visitsThisWeek = numberFromUnknown(week);
  } catch {
    // Table site_visits absente (migration 0006 non appliquée) : valeurs à 0.
  }

  const stats: DashboardStats = {
    totalActiveOffers: offers.filter((offer) => offer.status !== "Expirées").length,
    newOffersThisWeek: offers.filter((offer) => {
      if (!offer.createdAt) return false;
      const parsed = new Date(offer.createdAt).getTime();
      return Number.isFinite(parsed) && parsed >= oneWeekAgo;
    }).length,
    totalClicks,
    totalVisits,
    visitsToday,
    visitsThisWeek,
  };

  const { data: log } = await supabase
    .from("scraper_logs")
    .select("status,offers_added,message,started_at")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let scraperHealth: ScraperHealth;
  if (!log) {
    scraperHealth = {
      status: "idle",
      lastRunAt: null,
      offersAdded: null,
      message: "Aucune exécution enregistrée pour le moment.",
    };
  } else {
    scraperHealth = {
      status: normaliseRunStatus(log.status),
      lastRunAt: asIsoDate(log.started_at),
      offersAdded:
        log.offers_added === null || log.offers_added === undefined
          ? null
          : numberFromUnknown(log.offers_added),
      message: log.message ? String(log.message) : null,
    };
  }

  const sourceHealth = readSourceHealth();
  return { offers, cities, stats, scraperHealth, sourceHealth };
}

/** Variante Supabase des actions en masse (verify / archive / delete). */
async function applyBulkActionFromSupabase(
  supabase: NonNullable<ReturnType<typeof getSupabaseClient>>,
  action: BulkAction,
  uniqueIds: string[],
): Promise<{ updated: number }> {
  if (action === "delete") {
    const { data, error } = await supabase
      .from("job_offers")
      .delete()
      .in("id", uniqueIds)
      .select("id");
    return { updated: error ? 0 : (data?.length ?? 0) };
  }

  if (action === "verify") {
    const { data, error } = await supabase
      .from("job_offers")
      .update({ status: "published", is_verified: true })
      .in("id", uniqueIds)
      .select("id");
    return { updated: error ? 0 : (data?.length ?? 0) };
  }

  // archive
  const { data, error } = await supabase
    .from("job_offers")
    .update({ status: "archived", is_archived: true, is_expired: true })
    .in("id", uniqueIds)
    .select("id");
  return { updated: error ? 0 : (data?.length ?? 0) };
}

function resolvePythonBinary(): string | null {
  const candidates: Array<[string, string[]]> = [
    ["py", ["-3", "-c", "import sys; print(sys.executable)"]],
    ["python", ["-c", "import sys; print(sys.executable)"]],
    ["python3", ["-c", "import sys; print(sys.executable)"]],
  ];
  for (const [bin, args] of candidates) {
    try {
      const out = execSync(`"${bin}" ${args.join(" ")}`, {
        timeout: 4000,
        stdio: ["ignore", "pipe", "ignore"],
      })
        .toString()
        .trim();
      if (out) return bin;
    } catch {
      // candidate non disponible, on continue
    }
  }
  return null;
}

/**
 * Lance le scraper Python en arrière-plan (fire-and-forget).
 * Le pipeline Python écrit ses propres journaux dans scraper_logs ET dans
 * `data/admin-scraper-health.json`. On écrit aussi stdout/stderr du process
 * dans `data/scraper-last-run.log` pour déboguer les échecs de démarrage.
 */
export function launchScraperProcess() {
  const python = resolvePythonBinary();
  const sites = process.env.SCRAPER_SITES || "educarriere,emploici,boursedetude";
  const maxPerSite = process.env.SCRAPER_MAX_PER_SITE || "5";
  const script = path.join(process.cwd(), "scraper", "scraper.py");
  const dataDir = path.join(process.cwd(), "data");
  const logFile = path.join(dataDir, "scraper-last-run.log");

  const fail = (message: string) => {
    writeStoredScraperHealth({
      status: "error",
      lastRunAt: new Date().toISOString(),
      offersAdded: null,
      message,
    });
  };

  if (!python) {
    fail("Aucun interpréteur Python trouvé (essayé : py -3, python, python3).");
    return;
  }
  if (!existsSync(script)) {
    fail(`Script scraper introuvable : ${script}`);
    return;
  }

  try {
    mkdirSync(dataDir, { recursive: true });
    const stamp = new Date().toISOString();
    writeFileSync(
      logFile,
      `[${stamp}] Démarrage du scraper via ${python} ${script}\n`,
      "utf8",
    );
  } catch {
    // Échec création fichier de log → on continue quand même
  }

  const logFd = (() => {
    try {
      return openSync(logFile, "a");
    } catch {
      return "ignore" as const;
    }
  })();

  const childArgs = [script, "--sites", sites, "--max-per-site", String(maxPerSite)];

  let child: ReturnType<typeof spawn>;
  try {
    child = spawn(python, childArgs, {
      cwd: process.cwd(),
      // Sur Windows, on évite detached:true + unref() immédiat car le process
      // est souvent tué par le gestionnaire de processus Node. On le garde
      // rattaché brièvement ; le stdout/stderr redirigés vers un fichier
      // empêchent Node de le garder en vie indéfiniment.
      detached: process.platform !== "win32",
      stdio: ["ignore", typeof logFd === "number" ? logFd : "ignore", typeof logFd === "number" ? logFd : "ignore"],
      windowsHide: true,
      windowsVerbatimArguments: false,
    });
  } catch (err) {
    if (typeof logFd === "number") try { closeSync(logFd); } catch {}
    fail(`Impossible de lancer le scraper Python : ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  // Erreur asynchrone (ex: binaire Python introuvable au moment du spawn)
  child.on("error", (err) => {
    try {
      if (typeof logFd === "number") closeSync(logFd);
    } catch {}
    fail(`Échec du lancement du scraper Python : ${err.message}`);
  });

  // On attend 2 secondes pour vérifier que le process ne meurt pas
  // immédiatement (ex: erreur de syntaxe, module manquant). S'il est toujours
  // vivant au bout de 2 s, on considère que le lancement est réussi. Sinon
  // on lit le log pour remonter l'erreur.
  const startedAt = Date.now();
  const checkInterval = setInterval(() => {
    try {
      // closed: true OU exitCode !== null => process terminé
      const exited = (child as any).closed === true || (child as any).exitCode !== null && (child as any).exitCode !== undefined;
      if (exited) {
        clearInterval(checkInterval);
        const code = (child as any).exitCode;
        try {
          if (typeof logFd === "number") closeSync(logFd);
        } catch {}
        // On laisse Python écrire sa propre santé (success/error) via son
        // code. Mais si exitCode != 0 et que rien n'a été écrit, on écrit
        // l'erreur.
        if (code !== 0) {
          let tailLog = "";
          try { tailLog = readFileSync(logFile, "utf8").slice(-600); } catch {}
          fail(
            `Le scraper a échoué au démarrage (code ${code}). ` +
            (tailLog ? `Log : ${tailLog.replace(/\s+/g, " ").slice(0, 400)}` : "Consultez data/scraper-last-run.log."),
          );
        }
        return;
      }
      const elapsed = Date.now() - startedAt;
      if (elapsed >= 2500) {
        clearInterval(checkInterval);
        // Process toujours en vie : le lancement est considéré réussi.
        try {
          if (typeof logFd === "number") closeSync(logFd);
        } catch {}
        if (process.platform !== "win32") {
          try { child.unref(); } catch {}
        }
      }
    } catch {
      clearInterval(checkInterval);
    }
  }, 300);
}

function extractOffersAdded(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    record.offersAdded,
    record.added_count,
    record.addedCount,
    record.jobs_added,
    record.new_offers,
  ];

  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && candidate !== "") {
      return numberFromUnknown(candidate);
    }
  }

  return null;
}

function extractMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const message = record.message ?? record.detail ?? record.error;

    if (message) {
      return String(message);
    }
  }

  return fallback;
}

export async function triggerScraperRun() {
  const automationUrl =
    process.env.SCRAPER_AUTOMATION_URL ||
    process.env.AUTOMATION_API_URL ||
    process.env.SCRAPER_TRIGGER_URL ||
    process.env.N8N_SCRAPER_WEBHOOK_URL;

  // Réinitialise le cache mémoire pour forcer une relecture du fichier / DB
  // au prochain appel (sinon l'ancien statut "running" reste en mémoire
  // indéfiniment même après la fin du scraper).
  inMemoryScraperHealth = null;

  if (!automationUrl) {
    const state: ScraperHealth = {
      status: "running",
      lastRunAt: new Date().toISOString(),
      offersAdded: null,
      message:
        "Scraper lancé en arrière-plan. Le statut sera mis à jour à la fin de l'exécution. (Logs dans data/scraper-last-run.log)",
    };
    writeStoredScraperHealth(state);
    launchScraperProcess();
    return state;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const bearerToken =
    process.env.AUTOMATION_API_TOKEN || process.env.SCRAPER_AUTOMATION_TOKEN;
  const apiKey = process.env.AUTOMATION_API_KEY || process.env.SCRAPER_AUTOMATION_KEY;

  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  try {
    const response = await fetch(automationUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "admin-dashboard",
        triggeredAt: new Date().toISOString(),
      }),
    });

    const rawBody = await response.text();
    let payload: unknown = null;

    try {
      payload = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      payload = rawBody ? { message: rawBody } : null;
    }

    const status = response.ok
      ? normaliseRunStatus(
          payload && typeof payload === "object"
            ? (payload as Record<string, unknown>).status ?? "running"
            : "running",
        )
      : "error";

    const state: ScraperHealth = {
      status,
      lastRunAt: new Date().toISOString(),
      offersAdded: extractOffersAdded(payload),
      message: extractMessage(
        payload,
        response.ok
          ? "Le scraper a bien été déclenché."
          : `Échec du déclenchement (${response.status}).`,
      ),
    };

    writeStoredScraperHealth(state);
    return state;
  } catch (error) {
    const state: ScraperHealth = {
      status: "error",
      lastRunAt: new Date().toISOString(),
      offersAdded: null,
      message:
        error instanceof Error
          ? error.message
          : "Le déclenchement du scraper a échoué.",
    };
    writeStoredScraperHealth(state);
    return state;
  }
}

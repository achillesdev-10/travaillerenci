/**
 *  TravaillerEnCi — src/lib/admin-growth.ts
 *
 *  Statistiques de croissance du tableau de bord administrateur (§23) :
 *  inscrits, profils complétés, alertes actives, sauvegardes, CV, offres
 *  publiées, entreprises, sources de trafic et offres les plus consultées /
 *  les plus sauvegardées.
 *
 *  • Local : SQLite (tables auto-créées par leurs services)
 *  • Prod  : Supabase (service_role)
 *
 *  Chaque requête est défensive : si une table n'existe pas encore, le champ
 *  correspondant reste à 0 — le dashboard ne doit jamais tomber.
 *  Aucune donnée personnelle n'est renvoyée (compteurs + titres d'offres).
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase";
import { computeProfileCompletion } from "@/lib/profileCompletion";
import { PROFILE_COMPLETE_THRESHOLD } from "@/lib/analyticsEvents";
import { normalizeSource, sourceFromPath } from "@/lib/trafficSource";

export type GrowthTopOffer = {
  id: string;
  title: string;
  count: number;
};

export type AdminGrowthStats = {
  totalUsers: number;
  newUsersThisWeek: number;
  totalProfiles: number;
  /** Profils atteignant PROFILE_COMPLETE_THRESHOLD (%). */
  completedProfiles: number;
  profilesCompletedThisWeek: number;
  /** Liens CV renseignés. */
  totalResumes: number;
  activeAlerts: number;
  totalSavedItems: number;
  /** Offres dont le statut est « published ». */
  publishedOffers: number;
  /** Entreprises distinctes parmi les offres publiées. */
  companies: number;
  topViewedOffers: GrowthTopOffer[];
  topSavedOffers: GrowthTopOffer[];
  /** Sources de trafic (§23) : source → nombre de visites, classées. */
  trafficSources: GrowthTopOffer[];
};

export const EMPTY_GROWTH: AdminGrowthStats = {
  totalUsers: 0,
  newUsersThisWeek: 0,
  totalProfiles: 0,
  completedProfiles: 0,
  profilesCompletedThisWeek: 0,
  totalResumes: 0,
  activeAlerts: 0,
  totalSavedItems: 0,
  publishedOffers: 0,
  companies: 0,
  topViewedOffers: [],
  topSavedOffers: [],
  trafficSources: [],
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Agrégation (clé → valeur) → N entrées classées décroissant.
 * Passe séquentiellement : à valeur égale, l'ordre d'insertion est conservé.
 */
export function topEntries(
  agg: Record<string, number>,
  limit: number,
): Array<{ key: string; value: number }> {
  return Object.entries(agg)
    .filter(([, value]) => Number.isFinite(value) && value > 0)
    .map(([key, value]) => ({ key, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, Math.max(0, limit));
}

function numberFromUnknown(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Agrège les visites en sources de trafic (§23).
 *
 * Deux cas de figure :
 *   • la colonne `site_visits.source` existe (migration 0031) → on l'utilise ;
 *   • sinon on retombe sur le `utm_source` éventuellement présent dans le
 *     chemin de la visite.
 * Une visite sans information est comptée comme « direct ».
 */
export function trafficSourcesFromRows(
  rows: Array<{ source?: unknown; path?: unknown }>,
  limit = 5,
): GrowthTopOffer[] {
  const agg: Record<string, number> = {};
  for (const row of rows) {
    const explicit = String(row.source ?? "").trim();
    const source = explicit
      ? normalizeSource(explicit)
      : sourceFromPath(String(row.path ?? "")) || "direct";
    agg[source] = (agg[source] || 0) + 1;
  }
  return topEntries(agg, limit).map((entry) => ({
    id: entry.key,
    title: entry.key,
    count: entry.value,
  }));
}

// ---------------------------------------------------------------------------
//  SQLite
// ---------------------------------------------------------------------------
type SqliteDb = InstanceType<typeof DatabaseSync>;
type SqliteRow = Record<string, unknown>;

function openLocal(): SqliteDb | null {
  try {
    const dbPath = path.join(process.cwd(), "data", "travaillerenci.sqlite3");
    if (!existsSync(dbPath)) return null;
    return new DatabaseSync(dbPath);
  } catch {
    return null;
  }
}

function hasTable(db: SqliteDb, table: string): boolean {
  try {
    return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=$table").get({ $table: table }));
  } catch {
    return false;
  }
}

function safeAll(db: SqliteDb, table: string, sql: string): SqliteRow[] {
  try {
    if (!hasTable(db, table)) return [];
    return db.prepare(sql).all() as unknown as SqliteRow[];
  } catch {
    return [];
  }
}

/**
 * Visites avec leur source (§23). Repli sur le chemin seul quand la colonne
 * `source` n'existe pas encore (migration 0031 non appliquée).
 */
function siteVisitRows(db: SqliteDb): SqliteRow[] {
  const withSource = safeAll(db, "site_visits", "SELECT source, path FROM site_visits");
  if (withSource.length > 0) return withSource;
  return safeAll(db, "site_visits", "SELECT path FROM site_visits");
}

function growthFromSqlite(): AdminGrowthStats {
  const db = openLocal();
  if (!db) return EMPTY_GROWTH;

  try {
    const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();

    // Utilisateurs
    const userRows = safeAll(db, "users", "SELECT id, created_at FROM users");
    const totalUsers = userRows.length;
    const newUsersThisWeek = userRows.filter(
      (u) => String(u.created_at || "") >= weekAgo,
    ).length;

    // Profils candidat (completion calculée avec l'email via jointure)
    const profileRows = safeAll(
      db,
      "candidate_profiles",
      `SELECT p.*, u.email AS user_email
       FROM candidate_profiles p LEFT JOIN users u ON u.id = p.user_id`,
    );

    let completedProfiles = 0;
    let profilesCompletedThisWeek = 0;
    let totalResumes = 0;
    for (const row of profileRows) {
      const done = computeProfileCompletion({
        email: (row.user_email as string) || null,
        city: (row.city as string) || null,
        jobTitle: (row.job_title as string) || null,
        sectors: safeJsonArray(row.sectors),
        diploma: (row.diploma as string) || null,
        experienceLevel: (row.experience_level as string) || null,
        skills: safeJsonArray(row.skills),
        contractTypes: safeJsonArray(row.contract_types),
        phone: (row.phone as string) || null,
        bio: (row.bio as string) || null,
        resumeUrl: (row.resume_url as string) || null,
      }).percent;
      if (done >= PROFILE_COMPLETE_THRESHOLD) {
        completedProfiles++;
        if (String(row.updated_at || "") >= weekAgo) profilesCompletedThisWeek++;
      }
      if (row.resume_url) totalResumes++;
    }

    const alertRows = safeAll(db, "alerts", "SELECT active FROM alerts");
    const activeAlerts = alertRows.filter((a) => Number(a.active) === 1).length;

    // Sauvegardes (offres + stages uniquement)
    const saveRows = safeAll(
      db,
      "saved_items",
      "SELECT item_id FROM saved_items WHERE item_type IN ('job','internship')",
    );
    const totalSavedItems = saveRows.length;
    const saveAgg: Record<string, number> = {};
    for (const row of saveRows) {
      const id = String(row.item_id || "");
      if (id) saveAgg[id] = (saveAgg[id] || 0) + 1;
    }

    // Titres : une seule lecture de la table, réutilisée pour les 2 classements.
    const titleMap = new Map<string, string>();
    for (const row of safeAll(db, "job_offers", "SELECT id, title FROM job_offers")) {
      titleMap.set(String(row.id), String(row.title || ""));
    }

    // Offres les plus consultées
    const viewedRows = safeAll(
      db,
      "job_offers",
      `SELECT id, clicks_count FROM job_offers
       WHERE status = 'published' ORDER BY clicks_count DESC LIMIT 50`,
    );
    const viewedAgg: Record<string, number> = {};
    for (const row of viewedRows) {
      const id = String(row.id || "");
      if (id) viewedAgg[id] = numberFromUnknown(row.clicks_count);
    }

    const topViewedOffers = topEntries(viewedAgg, 5).map((entry) => ({
      id: entry.key,
      title: titleMap.get(entry.key) || entry.key,
      count: entry.value,
    }));

    // Offres les plus sauvegardées
    const topSavedOffers = topEntries(saveAgg, 5).map((entry) => ({
      id: entry.key,
      title: titleMap.get(entry.key) || entry.key,
      count: entry.value,
    }));

    // Offres publiées + entreprises distinctes (§23)
    const publishedRows = safeAll(
      db,
      "job_offers",
      "SELECT company FROM job_offers WHERE status = 'published'",
    );
    const companies = new Set(
      publishedRows
        .map((row) => String(row.company || "").trim().toLowerCase())
        .filter(Boolean),
    ).size;

    // Sources de trafic (§23)
    const trafficSources = trafficSourcesFromRows(siteVisitRows(db));

    return {
      totalUsers,
      newUsersThisWeek,
      totalProfiles: profileRows.length,
      completedProfiles,
      profilesCompletedThisWeek,
      totalResumes,
      activeAlerts,
      totalSavedItems,
      publishedOffers: publishedRows.length,
      companies,
      topViewedOffers,
      topSavedOffers,
      trafficSources,
    };
  } catch {
    return EMPTY_GROWTH;
  }
}

function safeJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
//  Supabase
// ---------------------------------------------------------------------------
async function growthFromSupabase(): Promise<AdminGrowthStats> {
  const supabase = getSupabaseClient();
  if (!supabase) return EMPTY_GROWTH;

  try {
    const weekAgo = new Date(Date.now() - WEEK_MS).toISOString();
    const [usersRes, profilesRes, alertsRes, savesRes, viewedRes, publishedRes, visitsRes] =
      await Promise.all([
        supabase.from("users").select("id,created_at"),
        supabase
          .from("candidate_profiles")
          .select(
            "user_id,city,diploma,sectors,job_title,experience_level,skills,contract_types,phone,bio,resume_url,created_at,updated_at,users(email)",
          ),
        supabase.from("alerts").select("id").eq("active", true),
        supabase
          .from("saved_items")
          .select("item_id")
          .in("item_type", ["job", "internship"]),
        supabase
          .from("job_offers")
          .select("id,title,clicks_count")
          .eq("status", "published")
          .order("clicks_count", { ascending: false })
          .limit(50),
        supabase.from("job_offers").select("company").eq("status", "published"),
        supabase.from("site_visits").select("source,path").limit(5000),
      ]);

    // Colonnes `source` absente (migration 0031 non appliquée) → repli `path`.
    let visitRows = (visitsRes.error ? [] : visitsRes.data || []) as Array<{
      source?: string | null;
      path?: string | null;
    }>;
    if (visitsRes.error) {
      const fallback = await supabase.from("site_visits").select("path").limit(5000);
      visitRows = (fallback.data || []) as Array<{ source?: string | null; path?: string | null }>;
    }

    const users = (usersRes.data || []) as Array<{ id: string; created_at: string }>;
    const profiles = (profilesRes.data || []) as any[];
    const totalUsers = users.length;
    const newUsersThisWeek = users.filter((u) => u.created_at >= weekAgo).length;

    let completedProfiles = 0;
    let profilesCompletedThisWeek = 0;
    let totalResumes = 0;
    for (const row of profiles) {
      const email = row.users?.email ?? null;
      const percent = computeProfileCompletion({
        email,
        city: row.city || null,
        jobTitle: row.job_title || null,
        sectors: row.sectors || [],
        diploma: row.diploma || null,
        experienceLevel: row.experience_level || null,
        skills: row.skills || [],
        contractTypes: row.contract_types || [],
        phone: row.phone || null,
        bio: row.bio || null,
        resumeUrl: row.resume_url || null,
      }).percent;
      if (percent >= PROFILE_COMPLETE_THRESHOLD) {
        completedProfiles++;
        if ((row.updated_at || "") >= weekAgo) profilesCompletedThisWeek++;
      }
      if (row.resume_url) totalResumes++;
    }

    const saves = (savesRes.data || []) as Array<{ item_id: string }>;
    const saveAgg: Record<string, number> = {};
    for (const row of saves) {
      const id = String(row.item_id || "");
      if (id) saveAgg[id] = (saveAgg[id] || 0) + 1;
    }

    const viewed = (viewedRes.data || []) as Array<{
      id: string;
      title: string;
      clicks_count: number;
    }>;
    const titles = new Map<string, string>();
    const viewedAgg: Record<string, number> = {};
    for (const row of viewed) {
      titles.set(row.id, row.title);
      viewedAgg[row.id] = numberFromUnknown(row.clicks_count);
    }

    const topSavedKeys = topEntries(saveAgg, 5).map((entry) => entry.key);
    const titleMap = new Map<string, string>(titles);
    if (topSavedKeys.length > 0) {
      const { data: savedTitles } = await supabase
        .from("job_offers")
        .select("id,title")
        .in("id", topSavedKeys);
      for (const row of (savedTitles || []) as Array<{ id: string; title: string }>) {
        titleMap.set(row.id, row.title);
      }
    }

    return {
      totalUsers,
      newUsersThisWeek,
      totalProfiles: profiles.length,
      completedProfiles,
      profilesCompletedThisWeek,
      totalResumes,
      activeAlerts: (alertsRes.data || []).length,
      totalSavedItems: saves.length,
      publishedOffers: publishedRes.error ? 0 : (publishedRes.data || []).length,
      companies: publishedRes.error
        ? 0
        : new Set(
            (publishedRes.data || [])
              .map((row: { company?: string | null }) =>
                String(row.company || "").trim().toLowerCase(),
              )
              .filter(Boolean),
          ).size,
      topViewedOffers: topEntries(viewedAgg, 5).map((entry) => ({
        id: entry.key,
        title: titles.get(entry.key) || entry.key,
        count: entry.value,
      })),
      topSavedOffers: topEntries(saveAgg, 5).map((entry) => ({
        id: entry.key,
        title: titleMap.get(entry.key) || entry.key,
        count: entry.value,
      })),
      trafficSources: trafficSourcesFromRows(visitRows),
    };
  } catch (err) {
    console.error("getGrowthStats supabase error:", err);
    return EMPTY_GROWTH;
  }
}

/** Statistiques de croissance du dashboard admin. */
export async function getGrowthStats(): Promise<AdminGrowthStats> {
  if (isSupabaseConfigured()) return growthFromSupabase();
  return growthFromSqlite();
}

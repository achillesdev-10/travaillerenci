"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  AdminDashboardData,
  BulkAction,
  DashboardOffer,
  ScraperHealth,
} from "../../../lib/admin-dashboard";
import type { JobOffersActivityPoint } from "@/services/jobOfferSchemaService";
import type { Report, ReportStatus } from "@/services/reportService";
import type { ResolvedContentItem } from "@/lib/itemResolver";
import {
  REPORT_REASON_LABELS,
  REPORT_TYPE_BADGES,
  formatReportDate,
} from "@/lib/reportLabels";

type DashboardReport = Report & { content: ResolvedContentItem | null };

type AdminDashboardClientProps = {
  initialData: AdminDashboardData;
  activity: JobOffersActivityPoint[];
  reportCounts: Record<ReportStatus, number>;
  latestReports: DashboardReport[];
};

const STATUS_OPTIONS = ["Toutes", "En attente", "Vérifiées", "Expirées"] as const;

const PAGE_SIZE = 10;

const BULK_ACTIONS: Array<{
  action: BulkAction;
  label: string;
  tone: string;
}> = [
  {
    action: "delete",
    label: "Supprimer",
    tone: "bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25",
  },
  {
    action: "verify",
    label: "Vérifier",
    tone: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25",
  },
  {
    action: "archive",
    label: "Archiver",
    tone: "bg-slate-800/60 text-slate-200 border border-white/10 hover:bg-slate-700/60",
  },
];

function formatShortDate(date: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(parsed);
}

function formatDeadline(date: string | null) {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(parsed);
}

function isDeadlinePassed(date: string | null) {
  if (!date) return false;
  const parsed = new Date(date);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
}

function statusClasses(status: DashboardOffer["status"]) {
  switch (status) {
    case "Vérifiées":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "Expirées":
      return "border-white/10 bg-white/[0.04] text-slate-400";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
}

function scraperStatusLabel(status: ScraperHealth["status"]) {
  switch (status) {
    case "success":
      return "Succès";
    case "running":
      return "En cours";
    case "error":
      return "Échec";
    default:
      return "En attente";
  }
}

function scraperStatusDot(status: ScraperHealth["status"]) {
  switch (status) {
    case "success":
      return "bg-emerald-400";
    case "running":
      return "bg-sky-400 animate-pulse";
    case "error":
      return "bg-rose-400";
    default:
      return "bg-slate-500";
  }
}

function scraperStatusClasses(status: ScraperHealth["status"]) {
  switch (status) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "running":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "error":
      return "border-rose-500/30 bg-rose-500/10 text-rose-300";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

/** Petit graphique en barres SVG pur (aucune dépendance externe). */
function ActivityChart({ activity }: { activity: JobOffersActivityPoint[] }) {
  const max = Math.max(1, ...activity.map((a) => a.total));

  if (activity.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-slate-500">
        Aucune donnée d'activité sur la période.
      </p>
    );
  }

  return (
    <div className="flex h-44 items-end gap-1.5 sm:gap-3">
      {activity.map((point) => (
        <div
          key={point.date}
          className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5"
        >
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all group-hover:from-emerald-500 group-hover:to-emerald-300"
              style={{ height: `${Math.max(3, (point.total / max) * 100)}%` }}
            />
            <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-slate-200 shadow-xl group-hover:block">
              {point.label} · {point.total} offre{point.total > 1 ? "s" : ""} (
              {point.verified} vérif.)
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-500">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

/** Échappe une cellule CSV contre l'injection de formule (= + - @ tab CR). */
function csvCell(value: string) {
  const escaped = value.replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(value)) {
    return `"'${escaped}"`;
  }
  return `"${escaped}"`;
}

function exportCsv(offers: DashboardOffer[]) {
  const header = [
    "Titre",
    "Entreprise",
    "Ville",
    "Statut",
    "Ajoutee le",
    "Date limite",
    "Clics",
    "Source",
  ];
  const rows = offers.map((offer) => [
    csvCell(offer.title),
    csvCell(offer.company),
    csvCell(offer.city),
    csvCell(offer.status),
    offer.createdAt ? csvCell(formatReportDate(offer.createdAt)) : csvCell(""),
    offer.deadline ? csvCell(formatReportDate(offer.deadline)) : csvCell(""),
    String(offer.clicks),
    csvCell(offer.sourceUrl || ""),
  ]);

  const csv = [header.join(";"), ...rows.map((row) => row.join(";"))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `offres-travaillerenci-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminDashboardClient({
  initialData,
  activity,
  reportCounts,
  latestReports,
}: AdminDashboardClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [offers, setOffers] = useState(initialData.offers);
  const [cities, setCities] = useState(initialData.cities);
  const [stats, setStats] = useState(initialData.stats);
  const [scraperHealth, setScraperHealth] = useState(initialData.scraperHealth);
  const [statusFilter, setStatusFilter] =
    useState<(typeof STATUS_OPTIONS)[number]>("Toutes");
  const [cityFilter, setCityFilter] = useState("Toutes");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  function redirectToLogin() {
    router.replace("/admin/login?next=/admin");
  }

  const filteredOffers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return offers.filter((offer) => {
      const matchesStatus =
        statusFilter === "Toutes" || offer.status === statusFilter;
      const matchesCity = cityFilter === "Toutes" || offer.city === cityFilter;
      const matchesSearch =
        !query ||
        offer.title.toLowerCase().includes(query) ||
        offer.company.toLowerCase().includes(query) ||
        offer.city.toLowerCase().includes(query);

      return matchesStatus && matchesCity && matchesSearch;
    });
  }, [cityFilter, offers, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredOffers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageOffers = useMemo(
    () => filteredOffers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filteredOffers, safePage],
  );

  const filteredIds = filteredOffers.map((offer) => offer.id);
  const allVisibleSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selectedIds.includes(id));

  function updateFromPayload(payload: AdminDashboardData) {
    setOffers(payload.offers);
    setCities(payload.cities);
    setStats(payload.stats);
    setScraperHealth(payload.scraperHealth);
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  async function handleBulkAction(action: BulkAction) {
    if (selectedIds.length === 0) {
      return;
    }

    setFeedback(null);

    const response = await fetch("/api/admin/offers/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        ids: selectedIds,
      }),
    });

    if (response.status === 401) {
      redirectToLogin();
      return;
    }

    const payload = (await response.json()) as
      | (AdminDashboardData & { message?: string })
      | { error?: string };

    if (!response.ok || !("offers" in payload)) {
      setFeedback({
        tone: "error",
        text:
          "error" in payload && payload.error
            ? payload.error
            : "L'action en masse a échoué.",
      });
      return;
    }

    updateFromPayload(payload);
    setSelectedIds([]);
    setFeedback({
      tone: "success",
      text:
        "message" in payload && payload.message
          ? payload.message
          : "La sélection a bien été traitée.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  async function handleTriggerScraper() {
    setFeedback(null);

    const response = await fetch("/api/admin/scraper", {
      method: "POST",
    });

    if (response.status === 401) {
      redirectToLogin();
      return;
    }

    const payload = (await response.json()) as
      | { scraperHealth: ScraperHealth; message?: string }
      | { error?: string };

    if (!response.ok || !("scraperHealth" in payload)) {
      setFeedback({
        tone: "error",
        text:
          "error" in payload && payload.error
            ? payload.error
            : "Impossible de déclencher le scraper.",
      });
      return;
    }

    setScraperHealth(payload.scraperHealth);
    setFeedback({
      tone: "success",
      text:
        payload.message ??
        payload.scraperHealth.message ??
        "Le scraper a bien été déclenché.",
    });

    startTransition(() => {
      router.refresh();
    });
  }

  function handleExportCsv() {
    if (filteredOffers.length === 0) {
      setFeedback({
        tone: "error",
        text: "Aucune offre à exporter avec les filtres actuels.",
      });
      return;
    }
    exportCsv(filteredOffers);
    setFeedback({
      tone: "success",
      text: `${filteredOffers.length} offre${filteredOffers.length > 1 ? "s" : ""} exportée${filteredOffers.length > 1 ? "s" : ""} en CSV.`,
    });
  }

  const statCards: Array<{
    label: string;
    value: number;
    hint: string;
    icon: React.ReactNode;
    accent: string;
    /** Si renseigné, la carte devient un lien. */
    href?: string;
  }> = [
    {
      label: "Offres actives",
      value: stats.totalActiveOffers,
      hint: "En attente ou vérifiées",
      accent: "from-emerald-500 to-teal-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
          <path d="M4 12h16" />
        </svg>
      ),
    },
    {
      label: "Nouvelles / semaine",
      value: stats.newOffersThisWeek,
      hint: "Ajoutées sur 7 jours",
      accent: "from-sky-500 to-blue-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3v16h16" />
          <path d="m7 14 4-4 3 3 5-6" />
        </svg>
      ),
    },
    {
      label: "Clics totaux",
      value: stats.totalClicks,
      hint: "Interactions suivies",
      accent: "from-amber-500 to-orange-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v18" />
          <path d="M7 7.5 12 3l5 4.5" />
          <path d="M5 16.5 12 21l7-4.5" />
        </svg>
      ),
    },
    {
      label: "Visites du site",
      value: stats.totalVisits,
      hint: `${stats.visitsToday} aujourd'hui · ${stats.visitsThisWeek} sur 7 jours`,
      accent: "from-fuchsia-500 to-purple-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18Z" />
        </svg>
      ),
    },
    {
      label: "Signalements en attente",
      value: reportCounts.pending,
      hint: "File de modération à traiter",
      accent: "from-rose-500 to-red-600",
      href: "/admin/reports",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* ===== En-tête ===== */}
      <section className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
              TravaillerenCi Admin
            </p>
            <div>
              <h1 className="font-[var(--font-display)] text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                Dashboard des offres
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-400">
                Suivez la santé du scraper, filtrez les annonces et gérez
                plusieurs offres en une seule action.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M5 21h14" />
              </svg>
              Exporter CSV
            </button>
            <button
              type="button"
              onClick={handleTriggerScraper}
              disabled={isPending}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 8V4" />
                <path d="m9 7 3-3 3 3" />
                <path d="M20 15a4 4 0 0 0-4-4h-1.3A6 6 0 1 0 6 17h10" />
                <path d="M16 19h6" />
                <path d="M19 16v6" />
              </svg>
              {isPending ? "Traitement..." : "Déclencher le scraper"}
            </button>
          </div>
        </div>

        {feedback ? (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}
      </section>

      {/* ===== Stats ===== */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((card) => {
          const inner = (
            <>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-400">{card.label}</p>
                <span
                  className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${card.accent}`}
                >
                  {card.icon}
                </span>
              </div>
              <p className="mt-4 font-[var(--font-display)] text-4xl font-black tracking-tight text-white">
                {card.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
            </>
          );

          return card.href ? (
            <Link
              key={card.label}
              href={card.href}
              className="hover-lift group block rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur transition"
            >
              {inner}
              <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition group-hover:text-emerald-300">
                Voir la file →
              </span>
            </Link>
          ) : (
            <article
              key={card.label}
              className="hover-lift rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur"
            >
              {inner}
            </article>
          );
        })}
      </section>

      {/* ===== Derniers signalements ===== */}
      <section className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
              Derniers signalements
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {reportCounts.pending > 0
                ? `${reportCounts.pending} signalement${reportCounts.pending > 1 ? "s" : ""} en attente de modération.`
                : "Aucun signalement en attente — la file de modération est à jour."}
            </p>
          </div>
          <Link
            href="/admin/reports"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-emerald-400 transition hover:text-emerald-300"
          >
            Ouvrir la file de modération
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m13 6 6 6-6 6" />
            </svg>
          </Link>
        </div>

        {latestReports.length === 0 ? (
          <div className="mt-5 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-6">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
              <svg className="h-5 w-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="m9 11 3 3L22 4" />
              </svg>
            </span>
            <div>
              <p className="text-sm font-semibold text-emerald-300">Tout est en ordre</p>
              <p className="text-xs text-slate-500">
                Aucun contenu signalé en attente pour le moment.
              </p>
            </div>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-white/[0.06]">
            {latestReports.map((report) => {
              const typeBadge = REPORT_TYPE_BADGES[report.item_type];
              const reasonBadge = REPORT_REASON_LABELS[report.reason];
              return (
                <li
                  key={report.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${typeBadge.className}`}
                    >
                      {typeBadge.label}
                    </span>
                    <div className="min-w-0">
                      {report.content ? (
                        <a
                          href={report.content.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={report.content.title}
                          className="block truncate font-medium text-white transition hover:text-emerald-300"
                        >
                          {report.content.title}
                        </a>
                      ) : (
                        <p className="truncate italic text-slate-500">
                          Contenu supprimé (id : {report.item_id.slice(0, 8)})
                        </p>
                      )}
                      {report.content && (
                        <p className="truncate text-xs text-slate-500">
                          {report.content.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0">
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${reasonBadge.className}`}
                    >
                      {reasonBadge.label}
                    </span>
                    <span className="text-xs text-slate-500">
                      {report.reporter_email || "Anonyme"} · {formatReportDate(report.created_at)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ===== Santé du scraper + activité ===== */}
      <section className="grid gap-4 xl:grid-cols-3">
        <article className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-400">Santé du scraper</p>
              <p className="mt-2 text-base font-semibold text-white">
                {scraperHealth.message ?? "Dernière exécution disponible"}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${scraperStatusClasses(
                scraperHealth.status,
              )}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${scraperStatusDot(scraperHealth.status)}`} />
              {scraperStatusLabel(scraperHealth.status)}
            </span>
          </div>

          <dl className="mt-5 space-y-3 border-t border-white/[0.06] pt-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Dernière exécution</dt>
              <dd className="text-right font-medium text-slate-200">
                {formatShortDate(scraperHealth.lastRunAt)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-slate-500">Offres ajoutées</dt>
              <dd className="font-semibold text-white">
                {scraperHealth.offersAdded ?? "N/A"}
              </dd>
            </div>
          </dl>
        </article>

        <article className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur xl:col-span-2">
          <div className="flex flex-col gap-1">
            <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
              Activité des 7 derniers jours
            </h2>
            <p className="text-sm text-slate-400">
              Offres ajoutées et vérifiées par jour (source : base locale).
            </p>
          </div>
          <div className="mt-6">
            <ActivityChart activity={activity} />
          </div>
        </article>
      </section>

      {/* ===== Liste des offres ===== */}
      <section className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
              Liste des offres
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {filteredOffers.length} offre{filteredOffers.length > 1 ? "s" : ""} affichée
              {filteredOffers.length > 1 ? "s" : ""} sur {offers.length} — page {safePage}/
              {totalPages}.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-2xl">
            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-medium text-slate-500">Rechercher</span>
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Titre, entreprise, ville..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-medium text-slate-500">Statut</span>
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(
                    event.target.value as (typeof STATUS_OPTIONS)[number],
                  );
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option} className="bg-slate-950">
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1.5 text-sm sm:col-span-2">
              <span className="text-xs font-medium text-slate-500">Ville</span>
              <select
                value={cityFilter}
                onChange={(event) => {
                  setCityFilter(event.target.value);
                  setPage(1);
                }}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50"
              >
                <option value="Toutes" className="bg-slate-950">Toutes</option>
                {cities.map((city) => (
                  <option key={city} value={city} className="bg-slate-950">
                    {city}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ===== Vue cartes (mobile < md) ===== */}
        <div className="mt-5 grid gap-3 md:hidden">
          {pageOffers.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.06] bg-slate-950/60 px-4 py-10 text-center text-sm text-slate-500">
              Aucune offre ne correspond aux filtres actuels.
            </p>
          ) : null}
          {pageOffers.map((offer) => {
            const isSelected = selectedIds.includes(offer.id);
            return (
              <article
                key={offer.id}
                className={`rounded-2xl border p-4 transition-colors ${
                  isSelected
                    ? "border-emerald-500/40 bg-emerald-500/[0.06]"
                    : "border-white/[0.08] bg-slate-950/60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(offer.id)}
                    aria-label={`Sélectionner ${offer.title}`}
                    className="mt-1 h-4 w-4 shrink-0 rounded border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                  />
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${statusClasses(
                      offer.status,
                    )}`}
                  >
                    {offer.status}
                  </span>
                </div>
                <h3 className="mt-2 font-semibold text-white">{offer.title}</h3>
                <p className="mt-0.5 text-sm text-slate-400">{offer.company}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M12 21s-7-5.5-7-11a7 7 0 0 1 14 0c0 5.5-7 11-7 11Z" />
                      <circle cx="12" cy="10" r="2.5" />
                    </svg>
                    {offer.city}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M3 3v18h18" />
                      <path d="m7 14 4-4 3 3 5-6" />
                    </svg>
                    {offer.clicks} clic{offer.clicks > 1 ? "s" : ""}
                  </span>
                  {offer.deadline ? (
                    <span
                      className={
                        isDeadlinePassed(offer.deadline)
                          ? "inline-flex items-center gap-1 font-medium text-rose-400"
                          : "inline-flex items-center gap-1"
                      }
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                      {formatDeadline(offer.deadline)}
                      {isDeadlinePassed(offer.deadline) && (
                        <span className="font-bold uppercase">expirée</span>
                      )}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs">
                  <span className="text-slate-500">Ajoutée : {formatShortDate(offer.createdAt)}</span>
                  {offer.sourceUrl ? (
                    <a
                      href={offer.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-emerald-400 hover:text-emerald-300"
                    >
                      Source ↗
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {/* ===== Table desktop (≥ md) ===== */}
        <div className="mt-5 hidden overflow-hidden rounded-2xl border border-white/[0.06] md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-left">
              <thead className="bg-slate-950/80">
                <tr className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-4">
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={() => {
                        if (allVisibleSelected) {
                          setSelectedIds((current) =>
                            current.filter((id) => !filteredIds.includes(id)),
                          );
                          return;
                        }
                        setSelectedIds((current) =>
                          Array.from(new Set([...current, ...filteredIds])),
                        );
                      }}
                      aria-label="Sélectionner toutes les offres visibles"
                      className="h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                    />
                  </th>
                  <th className="px-4 py-4">Offre</th>
                  <th className="px-4 py-4">Ville</th>
                  <th className="px-4 py-4">Statut</th>
                  <th className="px-4 py-4">Ajoutée le</th>
                  <th className="px-4 py-4">Date limite</th>
                  <th className="px-4 py-4">Clics</th>
                  <th className="px-4 py-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] bg-slate-900/40">
                {pageOffers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Aucune offre ne correspond aux filtres actuels.
                    </td>
                  </tr>
                ) : null}

                {pageOffers.map((offer) => {
                  const isSelected = selectedIds.includes(offer.id);

                  return (
                    <tr
                      key={offer.id}
                      className={`align-top transition ${
                        isSelected
                          ? "bg-emerald-500/[0.05]"
                          : "hover:bg-white/[0.03]"
                      }`}
                    >
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(offer.id)}
                          aria-label={`Sélectionner ${offer.title}`}
                          className="mt-1 h-4 w-4 rounded border-white/20 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                        />
                      </td>
                      <td className="px-4 py-4">
                        <div className="min-w-[240px]">
                          <p className="font-medium text-white">{offer.title}</p>
                          <p className="mt-1 text-sm text-slate-400">{offer.company}</p>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-slate-300">{offer.city}</td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(
                            offer.status,
                          )}`}
                        >
                          {offer.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-300">
                        {formatShortDate(offer.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-sm">
                        {offer.deadline ? (
                          <span
                            className={
                              isDeadlinePassed(offer.deadline)
                                ? "inline-flex items-center gap-1.5 font-semibold text-rose-400"
                                : "inline-flex items-center gap-1.5 text-slate-300"
                            }
                          >
                            {isDeadlinePassed(offer.deadline) && (
                              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            )}
                            {formatDeadline(offer.deadline)}
                            {isDeadlinePassed(offer.deadline) ? (
                              <span className="text-[10px] font-bold uppercase tracking-wide text-rose-400">
                                expirée
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm font-medium text-white">
                        {offer.clicks}
                      </td>
                      <td className="px-4 py-4 text-sm">
                        {offer.sourceUrl ? (
                          <a
                            href={offer.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="font-medium text-emerald-400 transition hover:text-emerald-300"
                          >
                            Ouvrir
                          </a>
                        ) : (
                          <span className="text-slate-600">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, safePage - 1))}
              disabled={safePage <= 1}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              ← Précédent
            </button>
            <span className="text-sm text-slate-500">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
              disabled={safePage >= totalPages}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Suivant →
            </button>
          </div>
        ) : null}
      </section>

      {/* ===== Barre d'actions en masse ===== */}
      {selectedIds.length > 0 ? (
        <div className="fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-3xl flex-col gap-3 rounded-3xl border border-white/10 bg-slate-900/95 p-4 text-white shadow-2xl shadow-black/50 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            {selectedIds.length} offre{selectedIds.length > 1 ? "s" : ""} sélectionnée
            {selectedIds.length > 1 ? "s" : ""}.
          </p>

          <div className="flex flex-wrap gap-2">
            {BULK_ACTIONS.map((bulkAction) => (
              <button
                key={bulkAction.action}
                type="button"
                onClick={() => void handleBulkAction(bulkAction.action)}
                disabled={isPending}
                className={`inline-flex flex-1 items-center justify-center rounded-2xl px-4 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none ${bulkAction.tone}`}
              >
                {bulkAction.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              aria-label="Annuler la sélection"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-slate-300 transition hover:bg-white/[0.08]"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import type { AdminAnalyticsData } from "@/lib/admin-analytics";

type AnalyticsClientProps = {
  initialData: AdminAnalyticsData;
};

function formatDate(date: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function deviceClasses(device: string | null) {
  switch (device) {
    case "Mobile":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "Bot":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    case "Desktop":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-300";
  }
}

function sourceBadge(data: AdminAnalyticsData) {
  switch (data.source) {
    case "supabase":
      return {
        label: "Source : Supabase",
        cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
    case "sqlite":
      return {
        label: "Source : base locale",
        cls: "border-sky-500/30 bg-sky-500/10 text-sky-300",
      };
    default:
      return {
        label: "Aucune donnée",
        cls: "border-white/10 bg-white/[0.04] text-slate-400",
      };
  }
}

/** Graphique en barres des visites sur 14 jours (SVG pur). */
function VisitsChart({ data }: { data: AdminAnalyticsData }) {
  const max = Math.max(1, ...data.visitsByDay.map((p) => p.visits));

  if (data.totalVisits === 0) {
    return (
      <p className="py-12 text-center text-sm text-slate-500">
        Aucune visite enregistrée sur la période.
      </p>
    );
  }

  return (
    <div className="flex h-48 items-end gap-1.5 sm:gap-2.5">
      {data.visitsByDay.map((point) => (
        <div
          key={point.date}
          className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1.5"
        >
          <div className="relative flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400 transition-all group-hover:from-emerald-500 group-hover:to-emerald-300"
              style={{ height: `${Math.max(4, (point.visits / max) * 100)}%` }}
            />
            <div className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg border border-white/10 bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-slate-200 shadow-xl group-hover:block">
              {point.label} · {point.visits} visite{point.visits > 1 ? "s" : ""}
            </div>
          </div>
          <span className="text-[10px] font-medium text-slate-500">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsClient({ initialData }: AnalyticsClientProps) {
  const [data] = useState(initialData);
  const [deviceFilter, setDeviceFilter] = useState<string>("all");

  const badge = sourceBadge(data);

  const statCards: Array<{
    label: string;
    value: number;
    hint: string;
    accent: string;
    icon: React.ReactNode;
  }> = [
    {
      label: "Visites totales",
      value: data.totalVisits,
      hint: "Depuis le début du tracking",
      accent: "from-emerald-500 to-teal-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18" />
          <path d="M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18Z" />
        </svg>
      ),
    },
    {
      label: "Aujourd'hui",
      value: data.visitsToday,
      hint: "Visites du jour",
      accent: "from-sky-500 to-blue-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      ),
    },
    {
      label: "Cette semaine",
      value: data.visitsThisWeek,
      hint: "Sur les 7 derniers jours",
      accent: "from-amber-500 to-orange-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 3v16h16" />
          <path d="m7 14 4-4 3 3 5-6" />
        </svg>
      ),
    },
    {
      label: "Visiteurs uniques",
      value: data.uniqueVisitors,
      hint: "IP distinctes enregistrées",
      accent: "from-fuchsia-500 to-purple-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        </svg>
      ),
    },
  ];

  const filteredRecent = useMemo(() => {
    if (deviceFilter === "all") return data.recentVisits;
    return data.recentVisits.filter((v) => v.device === deviceFilter);
  }, [data.recentVisits, deviceFilter]);

  return (
    <div className="space-y-6">
      {/* ===== En-tête ===== */}
      <section className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Mesure d'audience
            </p>
            <h1 className="mt-1 font-[var(--font-display)] text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Analytics du site
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Visites, pages populaires et appareils des candidats qui
              consultent TravaillerenCi.
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border px-3 py-1.5 text-xs font-semibold ${badge.cls}`}
          >
            {badge.label}
          </span>
        </div>

        {data.note ? (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {data.note}
          </div>
        ) : null}
      </section>

      {/* ===== Stats ===== */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.label}
            className="hover-lift rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur"
          >
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
          </article>
        ))}
      </section>

      {/* ===== Graphique ===== */}
      <section className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur sm:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
            Visites — 14 derniers jours
          </h2>
          <p className="text-sm text-slate-400">
            Nombre de pages vues enregistrées chaque jour.
          </p>
        </div>
        <div className="mt-6">
          <VisitsChart data={data} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        {/* ===== Top pages ===== */}
        <article className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur sm:p-6">
          <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
            Pages les plus visitées
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Classement des chemins les plus consultés.
          </p>

          {data.topPages.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Aucune donnée de navigation disponible.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {data.topPages.map((page, index) => (
                <li key={page.path} className="flex items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-xs font-bold text-slate-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-slate-200">
                      {page.path}
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                        style={{ width: `${Math.min(100, page.share * 2)}%` }}
                      />
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-bold text-white">{page.visits}</div>
                    <div className="text-[10px] text-slate-500">{page.share}%</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        {/* ===== Dernières visites ===== */}
        <article className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
                Dernières visites
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Les 12 derniers passages sur le site.
              </p>
            </div>
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              className="rounded-2xl border border-white/10 bg-slate-950 px-3 py-2 text-xs font-medium text-slate-200 outline-none transition focus:border-emerald-500/50"
            >
              <option value="all" className="bg-slate-950">Tous les appareils</option>
              <option value="Desktop" className="bg-slate-950">Desktop</option>
              <option value="Mobile" className="bg-slate-950">Mobile</option>
              <option value="Bot" className="bg-slate-950">Bots</option>
            </select>
          </div>

          {filteredRecent.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">
              Aucune visite ne correspond au filtre.
            </p>
          ) : (
            <ul className="mt-5 divide-y divide-white/[0.06]">
              {filteredRecent.map((visit, index) => (
                <li key={`${visit.createdAt}-${index}`} className="flex items-center gap-3 py-3">
                  <span
                    className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${deviceClasses(
                      visit.device,
                    )}`}
                  >
                    {visit.device ?? "Inconnu"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-slate-300">
                      {visit.path}
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-500">
                      {formatDate(visit.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}

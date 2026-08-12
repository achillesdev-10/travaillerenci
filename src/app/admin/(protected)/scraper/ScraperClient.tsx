"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ScraperHealth, ScraperRunRecord } from "@/lib/admin-dashboard";

type ScraperClientProps = {
  initialScraperHealth: ScraperHealth;
  initialRunHistory: ScraperRunRecord[];
  sources: string[];
  automationMode: "automatic" | "manual";
};

function timeAgo(date: string | null) {
  if (!date) return "Jamais";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  const diff = Date.now() - parsed.getTime();
  if (diff < 60_000) return "À l'instant";
  if (diff < 3_600_000) return `Il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `Il y a ${Math.floor(diff / 3_600_000)} h`;
  return `Il y a ${Math.floor(diff / 86_400_000)} j`;
}

function runStatusLabel(status: ScraperHealth["status"]) {
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

function runStatusClasses(status: ScraperHealth["status"]) {
  switch (status) {
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
    case "running":
      return "border-sky-500/30 bg-sky-500/10 text-sky-400";
    case "error":
      return "border-rose-500/30 bg-rose-500/10 text-rose-400";
    default:
      return "border-slate-700 bg-slate-800 text-slate-300";
  }
}

export default function ScraperClient({
  initialScraperHealth,
  initialRunHistory,
  sources,
  automationMode,
}: ScraperClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [scraperHealth, setScraperHealth] = useState(initialScraperHealth);
  const [runHistory, setRunHistory] = useState(initialRunHistory);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);

  async function refresh() {
    const response = await fetch("/api/admin/scraper", { cache: "no-store" });

    if (response.status === 401) {
      router.replace("/admin/login?next=/admin/scraper");
      return;
    }

    if (!response.ok) return;

    const payload = (await response.json()) as {
      scraperHealth: ScraperHealth;
      runHistory?: ScraperRunRecord[];
    };

    setScraperHealth(payload.scraperHealth);
    if (Array.isArray(payload.runHistory)) {
      setRunHistory(payload.runHistory);
    }
  }

  // Polling : rafraîchit l'état toutes les 10 secondes (pause si l'onglet
  // n'est pas visible pour économiser les requêtes).
  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    }, 10_000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleTrigger() {
    setFeedback(null);

    const response = await fetch("/api/admin/scraper", { method: "POST" });

    if (response.status === 401) {
      router.replace("/admin/login?next=/admin/scraper");
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

    // Premier rafraîchissement immédiat, puis le polling prend le relais.
    setTimeout(() => void refresh(), 1_500);
  }

  const running = scraperHealth.status === "running";
  const lastRunLabel = timeAgo(scraperHealth.lastRunAt);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
          Pilote du Scraper
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Surveillez et lancez l'importation automatisée d'offres d'emploi en
          Côte d'Ivoire. Mise à jour automatique toutes les 10 secondes.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 lg:p-8 shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <div className="text-base font-bold text-white">
              État du service scraper
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Python 3 / BeautifulSoup / SQLite cache
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border ${runStatusClasses(
              scraperHealth.status,
            )}`}
          >
            {running && (
              <span className="h-2 w-2 rounded-full bg-sky-400 animate-pulse" />
            )}
            {runStatusLabel(scraperHealth.status)}
          </span>
        </div>

        {feedback ? (
          <div
            className={`rounded-2xl border px-4 py-3 text-sm ${
              feedback.tone === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            }`}
          >
            {feedback.text}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Sources configurées
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {sources.length} plateforme{sources.length > 1 ? "s" : ""}
            </div>
            <div className="text-xs text-slate-500 mt-1 truncate">
              {sources.join(", ") || "Aucune source (variable SCRAPER_SITES)"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Dernier run
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {lastRunLabel}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {scraperHealth.offersAdded !== null &&
              scraperHealth.offersAdded !== undefined
                ? `${scraperHealth.offersAdded} nouvelle${scraperHealth.offersAdded > 1 ? "s" : ""} offre${scraperHealth.offersAdded > 1 ? "s" : ""} ajoutée${scraperHealth.offersAdded > 1 ? "s" : ""}`
                : "Aucun détail disponible"}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Mode d'exécution
            </div>
            <div className="text-2xl font-black text-white mt-2">
              {automationMode === "automatic" ? "Automatique" : "Manuel"}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {automationMode === "automatic"
                ? "Via service d'automatisation"
                : "Déclenchement depuis le dashboard"}
            </div>
          </div>
        </div>

        {scraperHealth.message ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
            {scraperHealth.message}
          </div>
        ) : null}

        <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => void handleTrigger()}
            disabled={isPending || running}
            className="rounded-2xl bg-primary text-slate-950 px-6 py-3 text-xs font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running
              ? "Extraction en cours..."
              : isPending
                ? "Déclenchement..."
                : "Déclencher une extraction"}
          </button>
          <a
            href="/admin/jobs"
            className="rounded-2xl border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800 px-5 py-3 text-xs font-bold transition-colors"
          >
            Voir les offres importées →
          </a>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 lg:p-8 shadow-xl space-y-5">
        <div>
          <h2 className="text-base font-bold text-white">
            Historique des exécutions
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Les {Math.max(runHistory.length, 1)} derniers runs enregistrés dans
            la base locale.
          </p>
        </div>

        {runHistory.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Aucune exécution enregistrée pour le moment. Lancez la première
            extraction pour voir l'historique.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-xs uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Offres ajoutées</th>
                    <th className="px-4 py-3">Détail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {runHistory.map((run, index) => (
                    <tr
                      key={`${run.lastRunAt ?? "run"}-${index}`}
                      className="hover:bg-slate-900/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${runStatusClasses(
                            run.status,
                          )}`}
                        >
                          {runStatusLabel(run.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {timeAgo(run.lastRunAt)}
                      </td>
                      <td className="px-4 py-3 font-bold text-white">
                        {run.offersAdded ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-400 max-w-md truncate">
                        {run.message ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

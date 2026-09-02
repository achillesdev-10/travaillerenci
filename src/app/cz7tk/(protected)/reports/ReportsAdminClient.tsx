'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Report, ReportStatus } from '@/services/reportService';
import type { ResolvedContentItem } from '@/lib/itemResolver';
import {
  REPORT_REASON_LABELS,
  REPORT_TYPE_BADGES,
  formatReportDate,
} from '@/lib/reportLabels';
import { csvCell, downloadCsv } from '@/lib/csvExport';

type ReportWithContent = Report & { content: ResolvedContentItem | null };
type StatusFilter = ReportStatus | 'all';

export default function ReportsAdminClient({
  initialReports,
  initialCounts,
}: {
  initialReports: ReportWithContent[];
  initialCounts: Record<ReportStatus, number>;
}) {
  const router = useRouter();
  const [reports, setReports] = useState<ReportWithContent[]>(initialReports);
  const [counts, setCounts] = useState<Record<ReportStatus, number>>(initialCounts);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [isMutating, setIsMutating] = useState<string | null>(null);

  async function readError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error) return data.error;
    } catch {
      // réponse non-JSON
    }
    return `Erreur serveur (${res.status}).`;
  }

  async function handleStatus(report: ReportWithContent, status: ReportStatus) {
    if (isMutating) return;
    setIsMutating(report.id);
    try {
      const res = await fetch(`/api/cz7tk/reports/${report.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        router.replace('/cz7tk/login?next=/cz7tk/reports');
        return;
      }
      if (!res.ok) throw new Error(await readError(res));

      // Utilise la réponse serveur (resolved_by = email admin) si disponible,
      // sinon repli optimiste sur les valeurs locales.
      const data = await res.json().catch(() => null);
      const now = new Date().toISOString();
      const updated: ReportWithContent = {
        ...report,
        status: data?.report?.status ?? status,
        resolved_at: data?.report?.resolved_at ?? (status === 'pending' ? null : now),
        resolved_by: data?.report?.resolved_by ?? (status === 'pending' ? null : 'admin'),
      };
      // Déplace l'entrée vers la vue active + met à jour les compteurs.
      setCounts((prev) => ({
        pending: prev.pending + (report.status === 'pending' ? -1 : 0) + (status === 'pending' ? 1 : 0),
        resolved: prev.resolved + (report.status === 'resolved' ? -1 : 0) + (status === 'resolved' ? 1 : 0),
        dismissed: prev.dismissed + (report.status === 'dismissed' ? -1 : 0) + (status === 'dismissed' ? 1 : 0),
      }));
      setReports((prev) => prev.map((r) => (r.id === report.id ? updated : r)));
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : 'Impossible de traiter ce signalement.');
    } finally {
      setIsMutating(null);
    }
  }

  const openCount = counts.pending;
  const totalCount = counts.pending + counts.resolved + counts.dismissed;
  const visibleReports =
    statusFilter === 'all' ? reports : reports.filter((r) => r.status === statusFilter);

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
            Signalements des utilisateurs
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Les signalements d'abus soumis depuis les fiches (frais demandés, contenu frauduleux…).
            Ouvrez le contenu signalé pour le modérer, puis traitez le signalement.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (visibleReports.length === 0) return;
            const headers = ['Type', 'Raison', 'Statut', 'Signalé par', 'Détails', 'Date'];
            const rows = visibleReports.map((r) => [
              csvCell(r.item_type),
              csvCell(REPORT_REASON_LABELS[r.reason]?.label || r.reason),
              csvCell(r.status),
              csvCell(r.reporter_email || 'Anonyme'),
              csvCell(r.details || ''),
              csvCell(formatReportDate(r.created_at)),
            ]);
            downloadCsv('signalements-travaillerenci', headers, rows);
          }}
          disabled={visibleReports.length === 0}
          className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" />
          </svg>
          Exporter CSV
        </button>
      </div>

      {/* Onglets de statut */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>En attente</span>
          {openCount > 0 && (
            <span className="bg-slate-950/40 px-2 py-0.5 rounded-full text-[10px] text-white">
              {openCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('resolved')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            statusFilter === 'resolved'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>Résolus</span>
          {counts.resolved > 0 && (
            <span className="bg-slate-950/40 px-2 py-0.5 rounded-full text-[10px] text-white">
              {counts.resolved}
            </span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('dismissed')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            statusFilter === 'dismissed'
              ? 'bg-slate-700 text-white'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>Classés</span>
          {counts.dismissed > 0 && (
            <span className="bg-slate-950/40 px-2 py-0.5 rounded-full text-[10px] text-white">
              {counts.dismissed}
            </span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            statusFilter === 'all'
              ? 'bg-primary text-slate-950'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Tous ({totalCount})
        </button>
      </div>

      {/* Limite d'affichage : la file est plafonnée aux 200 plus récents. */}
      {reports.length >= 200 && (
        <p className="text-xs text-slate-500 -mt-4">
          Affichage des 200 signalements les plus récents. Traitez ceux en
          attente pour faire remonter les plus anciens.
        </p>
      )}

      {/* Tableau */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 sm:py-4 sm:px-6 sticky left-0 z-10 bg-slate-900/50">Contenu signalé</th>
                <th className="py-3 px-3 sm:py-4 sm:px-6">Motif</th>
                <th className="py-3 px-3 sm:py-4 sm:px-6 hidden lg:table-cell">Signalé par</th>
                <th className="py-3 px-3 sm:py-4 sm:px-6 hidden sm:table-cell">Date</th>
                <th className="py-3 px-3 sm:py-4 sm:px-6">Statut</th>
                <th className="py-3 px-3 sm:py-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {visibleReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Aucun signalement dans cette vue.
                  </td>
                </tr>
              ) : (
                visibleReports.map((report) => {
                  const typeBadge = REPORT_TYPE_BADGES[report.item_type];
                  const reasonBadge = REPORT_REASON_LABELS[report.reason];
                  return (
                    <tr key={report.id} className="hover:bg-slate-900/40 transition-colors align-top">
                      <td className="py-3 px-3 sm:py-4 sm:px-6 max-w-xs sticky left-0 z-10 bg-slate-950 hover:bg-slate-900/40">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className={`shrink-0 inline-flex items-center rounded-full border px-1.5 sm:px-2 py-0.5 text-[9px] sm:text-[10px] font-bold ${typeBadge.className}`}>
                            {typeBadge.label}
                          </span>
                          {report.content ? (
                            <a
                              href={report.content.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-white truncate text-[13px] sm:text-sm hover:text-primary dark:hover:text-emerald-400 transition-colors"
                              title={report.content.title}
                            >
                              {report.content.title}
                            </a>
                          ) : (
                            <span className="text-slate-500 italic truncate text-[13px] sm:text-sm">
                              Contenu supprimé
                            </span>
                          )}
                        </div>
                        {report.content && (
                          <div className="text-[10px] sm:text-xs text-slate-400 truncate mt-0.5">
                            {report.content.subtitle}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6 max-w-xs">
                        <span className={`inline-flex items-center rounded-full border px-2 sm:px-2.5 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-bold ${reasonBadge.className}`}>
                          {reasonBadge.label}
                        </span>
                        {report.details && (
                          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed whitespace-pre-wrap break-words hidden sm:block">
                            {report.details}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6 text-xs text-slate-300 hidden lg:table-cell">
                        {report.reporter_email ? (
                          <>
                            <div className="truncate max-w-[180px]">{report.reporter_email}</div>
                            {report.reporter_user_id && (
                              <div className="text-[10px] text-slate-500 mt-0.5">
                                Compte : {report.reporter_user_id.slice(0, 8)}…
                              </div>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-500">Anonyme</span>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6 text-xs text-slate-400 whitespace-nowrap hidden sm:table-cell">
                        {formatReportDate(report.created_at)}
                        {report.resolved_by && report.resolved_at && report.status !== 'pending' && (
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            par {report.resolved_by} — {formatReportDate(report.resolved_at)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6">
                        <span className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold border ${
                          report.status === 'resolved'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : report.status === 'dismissed'
                            ? 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                            : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                        }`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            report.status === 'resolved' ? 'bg-emerald-400' : report.status === 'dismissed' ? 'bg-slate-400' : 'bg-amber-400'
                          }`} />
                          {report.status === 'resolved' ? 'Résolu' : report.status === 'dismissed' ? 'Classé' : 'Attente'}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-2">
                          {report.status !== 'resolved' && (
                            <button
                              type="button"
                              disabled={isMutating === report.id}
                              onClick={() => handleStatus(report, 'resolved')}
                              className="px-2 sm:px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] sm:text-xs font-bold border border-emerald-500/20 disabled:opacity-50 disabled:cursor-wait"
                            >
                              Résoudre
                            </button>
                          )}
                          {report.status !== 'dismissed' && (
                            <button
                              type="button"
                              disabled={isMutating === report.id}
                              onClick={() => handleStatus(report, 'dismissed')}
                              className="px-2 sm:px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-[10px] sm:text-xs font-semibold disabled:opacity-50 disabled:cursor-wait"
                            >
                              Classer
                            </button>
                          )}
                          {report.status !== 'pending' && (
                            <button
                              type="button"
                              disabled={isMutating === report.id}
                              onClick={() => handleStatus(report, 'pending')}
                              className="px-2 sm:px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[10px] sm:text-xs font-semibold border border-amber-500/20 disabled:opacity-50 disabled:cursor-wait"
                            >
                              Rouvrir
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

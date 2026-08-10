/**
 *  TravaillerEnCi — src/lib/reportLabels.ts
 *  Libellés & classes Tailwind partagés entre la file de modération
 *  (/admin/reports) et la vue d'ensemble (/admin) pour les signalements.
 */

import type { Report, ReportReason } from '@/services/reportService';

export const REPORT_TYPE_BADGES: Record<
  Report['item_type'],
  { label: string; className: string }
> = {
  job: { label: 'Emploi', className: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  internship: { label: 'Stage', className: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  scholarship: { label: 'Bourse', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  exam: { label: 'Concours', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

export const REPORT_REASON_LABELS: Record<ReportReason, { label: string; className: string }> = {
  frais_demandes: {
    label: 'Frais demandés',
    className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  contenu_frauduleux: {
    label: 'Contenu frauduleux',
    className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  },
  info_inexacte: {
    label: 'Informations inexactes',
    className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  },
  contenu_inapproprie: {
    label: 'Contenu inapproprié',
    className: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  },
  autre: { label: 'Autre motif', className: 'bg-slate-700/30 text-slate-400 border-slate-600/30' },
};

/** Formate une date de signalement (fr-FR, date + heure). */
export function formatReportDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

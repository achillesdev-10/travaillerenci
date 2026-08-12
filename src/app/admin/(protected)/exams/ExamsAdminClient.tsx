'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  Exam,
  ExamCategory,
  ExamConfidence,
  ExamStatus,
  ExamType,
} from '@/types/exam';
import {
  EXAM_CATEGORIES,
  EXAM_CONFIDENCE_LABEL,
  EXAM_STATUS_LABEL,
  EXAM_TYPES,
  examPhase,
} from '@/lib/examConstants';

const STATUS_TABS: Array<{ value: ExamStatus | 'all'; label: string }> = [
  { value: 'pending', label: 'En attente' },
  { value: 'published', label: 'Publiés' },
  { value: 'rejected', label: 'Rejetés' },
  { value: 'archived', label: 'Archivés' },
  { value: 'all', label: 'Tous' },
];

function toDateInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromDateInput(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T12:00:00`).toISOString();
}
function toDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromDatetimeInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(d);
}
function isPast(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

const EMPTY_FORM = {
  title: '',
  organizer: '',
  category: 'administratif' as ExamCategory,
  exam_type: '' as ExamType | '',
  status: 'pending' as ExamStatus,
  description_md: '',
  registration_start: '',
  registration_end: '',
  exam_date: '',
  results_date: '',
  age_min: '',
  age_max: '',
  age_reference_date: '',
  nationality: '',
  diplomas: '',
  positions_count: '',
  registration_fee: '',
  location: '',
  cities: '',
  documents: '',
  source_url: '',
  source_website: '',
  confidence: 'medium' as ExamConfidence,
  seo_title: '',
  seo_description: '',
  seo_keywords: '',
  slug: '',
};

type FormState = typeof EMPTY_FORM;

/** Résultat du contrôle anti-duplication (POST /api/admin/exams/similarity). */
type SimResult = {
  score: number | null;
  threshold: number;
  needsRewrite: boolean | null;
  message?: string;
  sourcePreview?: string;
  sourceLength?: number;
  descriptionLength?: number;
  sourceIsPdf?: boolean;
  error?: string;
};

export default function ExamsAdminClient({
  initialExams,
  initialStats,
}: {
  initialExams: Exam[];
  initialStats: {
    total: number;
    published: number;
    pending: number;
    rejected: number;
    totalViews: number;
    openNow: number;
  };
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [exams, setExams] = useState<Exam[]>(initialExams);
  const [stats, setStats] = useState(initialStats);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ExamStatus | 'all'>('pending');
  const [categoryFilter, setCategoryFilter] = useState<ExamCategory | 'all'>('all');

  const [editingExam, setEditingExam] = useState<Exam | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [modalNotice, setModalNotice] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [simChecking, setSimChecking] = useState(false);
  const [simResult, setSimResult] = useState<SimResult | null>(null);

  const filteredExams = useMemo(
    () =>
      exams.filter((e) => {
        const matchesSearch =
          !search ||
          e.title.toLowerCase().includes(search.toLowerCase()) ||
          e.organizer.toLowerCase().includes(search.toLowerCase());
        const matchesStatus =
          statusFilter === 'all' ? true : e.status === statusFilter;
        const matchesCategory =
          categoryFilter === 'all' ? true : e.category === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
      }),
    [exams, search, statusFilter, categoryFilter],
  );

  async function readError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error) return data.error;
    } catch {
      /* non-JSON */
    }
    return `Erreur serveur (${res.status}).`;
  }
  function redirectToLogin() {
    router.replace('/admin/login?next=/admin/exams');
  }

  function applyLocal(exam: Exam) {
    setExams((prev) => prev.map((e) => (e.id === exam.id ? exam : e)));
    setStats((prev) => ({
      ...prev,
      total: Math.max(0, prev.total),
      published:
        prev.published + (exam.status === 'published' && !prev ? 0 : 0),
    }));
    startTransition(() => router.refresh());
  }

  async function handleUpdateStatus(exam: Exam, newStatus: ExamStatus) {
    if (newStatus === 'published' && !exam.source_url) {
      alert(
        'Le lien officiel (source_url) est obligatoire avant de publier. Ouvrez « Éditer » pour le renseigner.',
      );
      openEditModal(exam, true);
      return;
    }
    const previous = exam;
    setExams((prev) => prev.map((e) => (e.id === exam.id ? { ...e, status: newStatus } : e)));
    try {
      const res = await fetch(`/api/admin/exams/${exam.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.status === 401) {
        setExams((prev) => prev.map((e) => (e.id === exam.id ? previous : e)));
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => router.refresh());
    } catch (err) {
      setExams((prev) => prev.map((e) => (e.id === exam.id ? previous : e)));
      alert(err instanceof Error ? err.message : 'Impossible de modifier le statut.');
    }
  }

  async function handleDelete(exam: Exam) {
    if (!confirm(`Supprimer le concours « ${exam.title} » ?`)) return;
    setExams((prev) => prev.filter((e) => e.id !== exam.id));
    try {
      const res = await fetch(`/api/admin/exams/${exam.id}`, { method: 'DELETE' });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => router.refresh());
    } catch (err) {
      setExams((prev) => [...prev, exam]);
      alert(err instanceof Error ? err.message : 'Impossible de supprimer ce concours.');
    }
  }

  function examToForm(exam: Exam): FormState {
    return {
      title: exam.title,
      organizer: exam.organizer,
      category: exam.category,
      exam_type: (exam.exam_type as ExamType | '') || '',
      status: exam.status,
      description_md: exam.description_md,
      registration_start: toDateInput(exam.registration_start),
      registration_end: toDatetimeInput(exam.registration_end),
      exam_date: toDateInput(exam.exam_date),
      results_date: toDateInput(exam.results_date),
      age_min: exam.age_min == null ? '' : String(exam.age_min),
      age_max: exam.age_max == null ? '' : String(exam.age_max),
      age_reference_date: exam.age_reference_date || '',
      nationality: exam.nationality || '',
      diplomas: (exam.diplomas || []).join(', '),
      positions_count: exam.positions_count == null ? '' : String(exam.positions_count),
      registration_fee: exam.registration_fee || '',
      location: exam.location || '',
      cities: (exam.cities || []).join(', '),
      documents: (exam.documents || []).map((d) => `${d.name}|${d.url}`).join('\n'),
      source_url: exam.source_url || '',
      source_website: exam.source_website || '',
      confidence: exam.confidence,
      seo_title: exam.seo_title || '',
      seo_description: exam.seo_description || '',
      seo_keywords: exam.seo_keywords || '',
      slug: exam.slug || '',
    };
  }

  function openCreateModal() {
    setIsCreating(true);
    setEditingExam(null);
    setModalNotice(null);
    setSimResult(null);
    setForm({ ...EMPTY_FORM, status: 'pending' });
  }

  function openEditModal(exam: Exam, notice?: boolean) {
    setEditingExam(exam);
    setIsCreating(false);
    setModalNotice(
      notice
        ? '⚠️ Le lien officiel (source_url) est obligatoire avant publication.'
        : null,
    );
    setSimResult(null);
    setForm(examToForm(exam));
  }

  function closeModal() {
    setEditingExam(null);
    setIsCreating(false);
    setModalNotice(null);
    setSimResult(null);
  }

  function formToPayload(f: FormState): Record<string, unknown> {
    return {
      title: f.title,
      organizer: f.organizer,
      category: f.category,
      exam_type: f.exam_type || null,
      status: f.status,
      description_md: f.description_md,
      registration_start: fromDateInput(f.registration_start),
      registration_end: fromDatetimeInput(f.registration_end),
      exam_date: fromDateInput(f.exam_date),
      results_date: fromDateInput(f.results_date),
      age_min: f.age_min === '' ? null : Number(f.age_min),
      age_max: f.age_max === '' ? null : Number(f.age_max),
      age_reference_date: f.age_reference_date || null,
      nationality: f.nationality || null,
      diplomas: f.diplomas.split(',').map((d) => d.trim().toUpperCase()).filter(Boolean),
      positions_count: f.positions_count === '' ? null : Number(f.positions_count),
      registration_fee: f.registration_fee || null,
      location: f.location || null,
      cities: f.cities.split(',').map((c) => c.trim()).filter(Boolean),
      documents: f.documents
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const idx = line.indexOf('|');
          return idx === -1
            ? { name: line, url: line }
            : { name: line.slice(0, idx).trim(), url: line.slice(idx + 1).trim() };
        }),
      source_url: f.source_url || null,
      source_website: f.source_website || null,
      confidence: f.confidence,
      seo_title: f.seo_title || null,
      seo_description: f.seo_description || null,
      seo_keywords: f.seo_keywords || null,
      slug: f.slug || null,
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.organizer.trim() || !form.description_md.trim()) {
      alert('Titre, organisateur et description sont obligatoires.');
      return;
    }
    // Validation front : source_url obligatoire avant publication.
    if (form.status === 'published' && !form.source_url.trim()) {
      alert('Le lien officiel (source_url) est obligatoire avant de publier ce concours.');
      return;
    }
    try {
      const res = await fetch(
        isCreating ? '/api/admin/exams' : `/api/admin/exams/${editingExam!.id}`,
        {
          method: isCreating ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formToPayload(form)),
        },
      );
      const data = await res.json();
      if (res.status === 401) {
        closeModal();
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l’enregistrement.');
      closeModal();
      startTransition(() => router.refresh());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  /** Contrôle anti-duplication : compare description ↔ communiqué source. */
  async function handleSimilarityCheck(description: string, sourceUrl: string) {
    setSimChecking(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/admin/exams/similarity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description_md: description, source_url: sourceUrl }),
      });
      const data = await res.json();
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        setSimResult({
          score: null,
          threshold: 0.3,
          needsRewrite: null,
          error: data?.error || `Erreur serveur (${res.status}).`,
        });
        return;
      }
      setSimResult(data as SimResult);
    } catch {
      setSimResult({
        score: null,
        threshold: 0.3,
        needsRewrite: null,
        error: 'Erreur réseau — vérification impossible.',
      });
    } finally {
      setSimChecking(false);
    }
  }

  /** Ouvre la fiche et lance immédiatement la vérification (actions tableau). */
  function openWithSimilarityCheck(exam: Exam) {
    openEditModal(exam);
    if (exam.source_url && exam.description_md.trim()) {
      void handleSimilarityCheck(exam.description_md, exam.source_url);
    }
  }

  const countFor = (s: ExamStatus | 'all') =>
    s === 'all' ? exams.length : exams.filter((e) => e.status === s).length;

  return (
    <div className="space-y-8 pb-24">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-extrabold tracking-tight text-white lg:text-3xl">
            Concours administratifs
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Modération des concours collectés depuis les sources officielles —
            éligibilité, dates clés, documents et publication.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 self-start rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-primary/20 transition-all hover:brightness-110"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouveau concours
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total" value={stats.total} tone="text-white" />
        <StatCard label="En attente" value={stats.pending} tone="text-amber-400" />
        <StatCard label="Publiés" value={stats.published} tone="text-emerald-400" />
        <StatCard label="Ouverts" value={stats.openNow} tone="text-sky-400" />
        <StatCard label="Vues cumulées" value={stats.totalViews} tone="text-fuchsia-400" />
      </div>

      {/* Onglets statut */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              statusFilter === tab.value
                ? tab.value === 'pending'
                  ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                  : tab.value === 'published'
                    ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                    : tab.value === 'rejected'
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
                      : 'bg-primary text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
            <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-[10px] text-white">
              {countFor(tab.value)}
            </span>
          </button>
        ))}
      </div>

      {/* Recherche + filtre catégorie */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:w-96">
          <svg className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par titre, organisateur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white transition-colors focus:border-primary focus:outline-none"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ExamCategory | 'all')}
          className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 focus:border-primary focus:outline-none"
        >
          <option value="all">Toutes les catégories</option>
          {EXAM_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Concours / Organisateur</th>
                <th className="px-6 py-4">Catégorie</th>
                <th className="px-6 py-4">Diplômes</th>
                <th className="px-6 py-4">Clôture inscriptions</th>
                <th className="px-6 py-4">Confiance</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Aucun concours trouvé dans cette vue.
                  </td>
                </tr>
              ) : (
                filteredExams.map((exam) => {
                  const phase = examPhase(exam);
                  return (
                    <tr key={exam.id} className="transition-colors hover:bg-slate-900/40">
                      <td className="max-w-xs px-6 py-4">
                        <a
                          href={`/concours/${exam.slug || exam.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-2 font-bold text-white transition-colors hover:text-primary"
                        >
                          {exam.title}
                        </a>
                        <div className="mt-0.5 truncate text-xs text-slate-400">
                          {exam.organizer}
                          {exam.source_website && (
                            <span className="font-medium text-primary/80"> · {exam.source_website}</span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-500">
                          {exam.views_count} vues · {exam.positions_count != null ? `${exam.positions_count} postes` : ''}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-300">
                          {EXAM_CATEGORIES.find((c) => c.value === exam.category)?.label || exam.category}
                        </span>
                        <span className="mt-1 block text-[10px] text-slate-500">{phase}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex max-w-[160px] flex-wrap gap-1">
                          {exam.diplomas.slice(0, 3).map((d) => (
                            <span key={d} className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
                              {d}
                            </span>
                          ))}
                          {exam.diplomas.length > 3 && (
                            <span className="text-[10px] text-slate-500">+{exam.diplomas.length - 3}</span>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-xs">
                        {exam.registration_end ? (
                          <span className={isPast(exam.registration_end) ? 'text-rose-400' : 'text-slate-300'}>
                            {formatDate(exam.registration_end)}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                            exam.confidence === 'high'
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                              : exam.confidence === 'low'
                                ? 'border-rose-500/30 bg-rose-500/15 text-rose-400'
                                : 'border-amber-500/30 bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          {EXAM_CONFIDENCE_LABEL[exam.confidence]}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                            exam.status === 'published'
                              ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400'
                              : exam.status === 'rejected'
                                ? 'border-rose-500/30 bg-rose-500/15 text-rose-400'
                                : exam.status === 'archived'
                                  ? 'border-slate-600/30 bg-slate-700/30 text-slate-400'
                                  : 'border-amber-500/30 bg-amber-500/15 text-amber-400'
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              exam.status === 'published'
                                ? 'bg-emerald-400'
                                : exam.status === 'rejected'
                                  ? 'bg-rose-400'
                                  : exam.status === 'archived'
                                    ? 'bg-slate-400'
                                    : 'bg-amber-400'
                            }`}
                          />
                          {EXAM_STATUS_LABEL[exam.status]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="space-x-2">
                          {exam.status !== 'published' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(exam, 'published')}
                              className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 transition-colors hover:bg-emerald-500/20"
                            >
                              Valider & publier
                            </button>
                          )}
                          {exam.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(exam, 'rejected')}
                              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/20"
                            >
                              Rejeter
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openWithSimilarityCheck(exam)}
                            disabled={!exam.source_url}
                            title={
                              exam.source_url
                                ? 'Comparer la description avec le communiqué officiel'
                                : 'source_url manquant — renseignez-le dans « Éditer »'
                            }
                            className="rounded-xl bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-400 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            🔎 Sim.
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(exam)}
                            className="rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-200 transition-colors hover:bg-slate-700"
                          >
                            Éditer
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(exam)}
                            className="rounded-xl bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-400 transition-colors hover:bg-rose-500/20"
                          >
                            Supprimer
                          </button>
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

      {/* Modal édition / création */}
      {(editingExam || isCreating) && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="mx-auto my-8 w-full max-w-4xl space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl lg:p-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="font-[var(--font-display)] text-xl font-bold text-white">
                  {isCreating ? 'Créer un concours' : 'Éditer le concours'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-400">
                  Modérez les champs structurés — le lien officiel (source_url) est obligatoire avant publication.
                </p>
              </div>
              <button type="button" onClick={closeModal} className="text-xl font-bold text-slate-400 hover:text-white">
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {modalNotice && (
                <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-300/90">
                  {modalNotice}
                </p>
              )}

              {/* 1. Informations générales */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">1. Informations générales</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Titre *">
                    <input type="text" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Organisateur *">
                    <input type="text" required value={form.organizer} onChange={(e) => setForm({ ...form, organizer: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Catégorie">
                    <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExamCategory })} className={inputCls}>
                      {EXAM_CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Type de concours">
                    <select value={form.exam_type} onChange={(e) => setForm({ ...form, exam_type: e.target.value as ExamType | '' })} className={inputCls}>
                      <option value="">— Non précisé —</option>
                      {EXAM_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Statut">
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ExamStatus })} className={inputCls}>
                      <option value="pending">En attente</option>
                      <option value="published">Publié</option>
                      <option value="rejected">Rejeté</option>
                      <option value="archived">Archivé</option>
                    </select>
                  </Field>
                  <Field label="Confiance IA (priorité de relecture)">
                    <select value={form.confidence} onChange={(e) => setForm({ ...form, confidence: e.target.value as ExamConfidence })} className={inputCls}>
                      <option value="high">Élevée</option>
                      <option value="medium">Moyenne</option>
                      <option value="low">Faible — à relire</option>
                    </select>
                  </Field>
                  <Field label="Lieu">
                    <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Villes (séparées par des virgules)">
                    <input type="text" value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Nombre de postes">
                    <input type="number" min={0} value={form.positions_count} onChange={(e) => setForm({ ...form, positions_count: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Frais d'inscription">
                    <input type="text" placeholder="ex: 10 000 FCFA" value={form.registration_fee} onChange={(e) => setForm({ ...form, registration_fee: e.target.value })} className={inputCls} />
                  </Field>
                </div>
              </div>

              {/* 2. Éligibilité */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">2. Conditions d'éligibilité</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label="Âge min">
                    <input type="number" min={0} value={form.age_min} onChange={(e) => setForm({ ...form, age_min: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Âge max">
                    <input type="number" min={0} value={form.age_max} onChange={(e) => setForm({ ...form, age_max: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Référence d'âge">
                    <input type="text" placeholder="ex: au 31 décembre 2026" value={form.age_reference_date} onChange={(e) => setForm({ ...form, age_reference_date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Nationalité">
                    <input type="text" placeholder="ex: ivoirienne" value={form.nationality} onChange={(e) => setForm({ ...form, nationality: e.target.value })} className={inputCls} />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Diplômes acceptés (séparés par des virgules)">
                      <input type="text" placeholder="ex: CEPE, BEPC, BAC" value={form.diplomas} onChange={(e) => setForm({ ...form, diplomas: e.target.value })} className={inputCls} />
                    </Field>
                  </div>
                </div>
              </div>

              {/* 3. Dates clés */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">3. Dates clés</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                  <Field label="Début inscriptions">
                    <input type="date" value={form.registration_start} onChange={(e) => setForm({ ...form, registration_start: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Clôture inscriptions">
                    <input type="datetime-local" value={form.registration_end} onChange={(e) => setForm({ ...form, registration_end: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Épreuves">
                    <input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Résultats">
                    <input type="date" value={form.results_date} onChange={(e) => setForm({ ...form, results_date: e.target.value })} className={inputCls} />
                  </Field>
                </div>
              </div>

              {/* 4. Description + documents */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">4. Description & documents</h4>
                <Field label="Description (Markdown) *">
                  <textarea rows={6} required value={form.description_md} onChange={(e) => { setForm({ ...form, description_md: e.target.value }); setSimResult(null); }} className={`${inputCls} font-mono text-xs`} />
                </Field>

                {/* Contrôle anti-duplication (§2.6) */}
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                        Contrôle anti-duplication
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        Compare la description avec le texte du communiqué officiel
                        (source_url) — seuil de réécriture : 30 %. Protège la fiche
                        d'une pénalité Google pour contenu dupliqué.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSimilarityCheck(form.description_md, form.source_url)}
                      disabled={simChecking || !form.description_md.trim() || !form.source_url.trim()}
                      className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-4 py-2.5 text-xs font-bold text-sky-400 transition-colors hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {simChecking ? (
                        <>
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                          Analyse en cours…
                        </>
                      ) : (
                        'Vérifier la similarité'
                      )}
                    </button>
                  </div>
                  {simResult && <SimResultPanel result={simResult} />}
                </div>
                <Field label="Documents PDF (une ligne par document — format : Nom|URL)">
                  <textarea rows={3} placeholder={'Annales 2024|https://…/annales.pdf\nArrêté d\'ouverture|https://…/arrete.pdf'} value={form.documents} onChange={(e) => setForm({ ...form, documents: e.target.value })} className={`${inputCls} font-mono text-xs`} />
                </Field>
              </div>

              {/* 5. Source + SEO */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-primary">5. Source & SEO</h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Lien officiel (source_url) * — obligatoire avant publication">
                    <input type="text" value={form.source_url} onChange={(e) => { setForm({ ...form, source_url: e.target.value }); setSimResult(null); }} className={inputCls} />
                  </Field>
                  <Field label="Site d'origine">
                    <input type="text" value={form.source_website} onChange={(e) => setForm({ ...form, source_website: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="SEO Title">
                    <input type="text" value={form.seo_title} onChange={(e) => setForm({ ...form, seo_title: e.target.value })} className={inputCls} />
                  </Field>
                  <Field label="Slug">
                    <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inputCls} />
                  </Field>
                </div>
                <Field label={`SEO Description (${form.seo_description.length}/160)`}>
                  <textarea rows={2} maxLength={160} value={form.seo_description} onChange={(e) => setForm({ ...form, seo_description: e.target.value })} className={inputCls} />
                </Field>
                <Field label="SEO Keywords">
                  <input type="text" value={form.seo_keywords} onChange={(e) => setForm({ ...form, seo_keywords: e.target.value })} className={inputCls} />
                </Field>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
                <button type="button" onClick={closeModal} className="rounded-2xl bg-slate-800 px-5 py-3 text-xs font-bold text-slate-300 transition-colors hover:bg-slate-700">
                  Annuler
                </button>
                <button type="submit" className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-primary/20 transition-all hover:brightness-110">
                  {isCreating ? 'Créer le concours' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputCls =
  'w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none transition-colors';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 ml-1 block text-[10px] font-bold uppercase tracking-widest text-slate-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function SimResultPanel({ result }: { result: SimResult }) {
  if (result.error) {
    return (
      <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-300">
        ⚠️ {result.error}
      </div>
    );
  }
  if (result.score === null) {
    return (
      <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-300">
        {result.message || 'Vérification impossible.'}
      </div>
    );
  }
  const ok = !result.needsRewrite;
  const pct = Math.min(100, Math.round((result.score ?? 0) * 100));
  return (
    <div
      className={`mt-3 rounded-xl border px-3 py-3 text-xs ${
        ok
          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
          : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-lg font-extrabold ${ok ? 'text-emerald-400' : 'text-rose-400'}`}>
          {pct} %
        </span>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${ok ? 'bg-emerald-400' : 'bg-rose-400'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="shrink-0 text-[10px] text-slate-400">
          seuil {Math.round(result.threshold * 100)} %
        </span>
      </div>
      <p className="mt-2 leading-relaxed">{result.message}</p>
      <p className="mt-1 text-[10px] text-slate-400">
        Description : {result.descriptionLength} caractères · Source :{' '}
        {result.sourceLength} caractères
      </p>
      {result.sourcePreview && (
        <details className="mt-2">
          <summary className="cursor-pointer text-[10px] font-bold text-slate-400">
            Extrait du communiqué source
          </summary>
          <p className="mt-1 rounded-lg bg-slate-950/80 p-2 leading-relaxed text-slate-400">
            {result.sourcePreview}…
          </p>
        </details>
      )}
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
      <div className={`text-2xl font-extrabold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}

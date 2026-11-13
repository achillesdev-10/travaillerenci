'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Article, ArticleAdminAction, ArticleStatus } from '@/types/article';
import type {
  NewsAutomationSettings,
  NewsPipelineRun,
  NewsSource,
  NewsStats,
} from '@/types/news';
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS } from '@/lib/news/categories';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';

const STATUS_TABS: Array<{ value: ArticleStatus | 'all'; label: string; activeClass: string }> = [
  {
    value: 'pending_review',
    label: 'À valider',
    activeClass: 'bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20',
  },
  { value: 'published', label: 'Publiés', activeClass: 'bg-brand text-slate-950 shadow-lg shadow-brand/20' },
  { value: 'draft', label: 'Brouillons', activeClass: 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' },
  { value: 'rejected', label: 'Rejetés', activeClass: 'bg-rose-500 text-slate-950 shadow-lg shadow-rose-500/20' },
  { value: 'archived', label: 'Archivés', activeClass: 'bg-slate-700 text-white' },
  { value: 'all', label: 'Tous', activeClass: 'bg-primary text-slate-950' },
];

const STATUS_BADGES: Record<ArticleStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Brouillon', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  published: { label: 'Publié', className: 'bg-brand/15 text-brand border-brand/30', dot: 'bg-brand' },
  archived: { label: 'Archivé', className: 'bg-slate-700/30 text-slate-400 border-slate-600/30', dot: 'bg-slate-400' },
  pending_review: { label: 'À valider', className: 'bg-sky-500/15 text-sky-400 border-sky-500/30', dot: 'bg-sky-400' },
  rejected: { label: 'Rejeté', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dot: 'bg-rose-400' },
};

const CATEGORY_LABELS: Record<string, string> = NEWS_CATEGORY_LABELS;

/** Champs numériques exposés dans la console d'automatisation. */
const NUMERIC_SETTINGS: Array<{
  key: keyof NewsAutomationSettings;
  label: string;
  min: number;
  max: number;
  suffix?: string;
}> = [
  { key: 'collect_interval_hours', label: 'Intervalle de collecte', min: 1, max: 24, suffix: 'h' },
  { key: 'review_minutes', label: 'Fenêtre de validation', min: 1, max: 120, suffix: 'min' },
  { key: 'daily_limit', label: 'Articles / jour', min: 1, max: 20 },
  { key: 'max_new_articles_per_run', label: 'Articles / collecte', min: 1, max: 5 },
  { key: 'max_ai_calls_per_day', label: 'Appels IA / jour', min: 1, max: 30 },
  { key: 'min_sources', label: 'Sources minimum', min: 1, max: 5 },
  { key: 'min_content_chars', label: 'Contenu minimum', min: 400, max: 5000, suffix: 'car.' },
  { key: 'max_candidates', label: 'Candidats / collecte', min: 1, max: 30 },
  { key: 'max_item_age_hours', label: 'Fraîcheur maximale', min: 6, max: 168, suffix: 'h' },
  { key: 'pending_max_hours', label: 'Rétention en attente', min: 1, max: 72, suffix: 'h' },
  { key: 'rejected_retention_days', label: 'Rétention rejetés', min: 1, max: 60, suffix: 'j' },
  { key: 'published_recent_days', label: 'Durée « récent »', min: 7, max: 90, suffix: 'j' },
  { key: 'archived_retention_days', label: 'Rétention archivés', min: 30, max: 365, suffix: 'j' },
  { key: 'manual_archived_retention_days', label: 'Rétention archivés modifiés', min: 30, max: 365, suffix: 'j' },
  { key: 'seen_retention_days', label: 'Rétention anti-doublon', min: 7, max: 180, suffix: 'j' },
];

interface EditForm {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  cover_image: string;
  source_url: string;
}

interface AutomationPayload {
  settings: NewsAutomationSettings;
  sources: NewsSource[];
  stats: NewsStats | null;
  runs: NewsPipelineRun[];
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

function formatRemaining(deadline: string | null, now: number): string | null {
  if (!deadline) return null;
  const time = Date.parse(deadline);
  if (Number.isNaN(time)) return null;
  const diff = time - now;
  if (diff <= 0) return 'Échéance atteinte';
  const totalSeconds = Math.floor(diff / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function emptyForm(article: Article): EditForm {
  return {
    title: article.title,
    excerpt: article.excerpt || '',
    content: article.content || '',
    category: article.category,
    cover_image: article.cover_image || '',
    source_url: article.source_url || '',
  };
}

export default function ActualitesAdminClient({
  initialArticles,
  initialTotal,
}: {
  initialArticles: Article[];
  initialTotal: number;
}) {
  const router = useRouter();
  const [articles, setArticles] = useState<Article[]>(initialArticles);
  const [total, setTotal] = useState(initialTotal);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('pending_review');
  const [editing, setEditing] = useState<Article | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Console d'automatisation
  const [automationOpen, setAutomationOpen] = useState(false);
  const [automation, setAutomation] = useState<AutomationPayload | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<NewsAutomationSettings | null>(null);
  const [automationBusy, setAutomationBusy] = useState(false);
  const [automationNotice, setAutomationNotice] = useState<string | null>(null);

  // Horloge partagée : un seul intervalle pour tous les comptes à rebours.
  const [now, setNow] = useState(() => Date.now());
  const hasPending = articles.some((article) => article.status === 'pending_review');
  useEffect(() => {
    if (!hasPending) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [hasPending]);

  async function readError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error) return data.error;
    } catch {
      /* réponse non-JSON */
    }
    return `Erreur serveur (${res.status}).`;
  }

  function redirectToLogin() {
    router.replace('/cz7tk/login?next=/cz7tk/actualites');
  }

  const filteredArticles = useMemo(() => {
    const q = search.toLowerCase();
    return articles.filter((article) => {
      const matchesStatus = statusFilter === 'all' ? true : article.status === statusFilter;
      const matchesSearch =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.category.toLowerCase().includes(q) ||
        (article.sources ?? []).some((source) => source.name.toLowerCase().includes(q));
      return matchesStatus && matchesSearch;
    });
  }, [articles, statusFilter, search]);

  const statusCount = useCallback(
    (status: ArticleStatus | 'all') =>
      status === 'all' ? articles.length : articles.filter((a) => a.status === status).length,
    [articles],
  );

  function applyArticle(updated: Article) {
    setArticles((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));
  }

  function closeEditor() {
    setEditing(null);
    setForm(null);
    setPreviewMode(false);
  }

  function openEditor(article: Article) {
    setEditing(article);
    setForm(emptyForm(article));
    setPreviewMode(false);
  }

  async function sendPatch(
    article: Article,
    payload: Record<string, unknown>,
  ): Promise<Article | null> {
    const res = await fetch(`/api/cz7tk/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.status === 401) {
      redirectToLogin();
      return null;
    }
    if (!res.ok) throw new Error(await readError(res));
    const data = await res.json();
    return (data.article as Article) ?? null;
  }

  async function handleAction(
    article: Article,
    action: ArticleAdminAction,
    reason?: string,
    articlePatch?: EditForm | null,
  ) {
    const previous = articles;
    if (action === 'publish') {
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, status: 'published' as ArticleStatus } : a)),
      );
    }
    if (action === 'reject') {
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, status: 'rejected' as ArticleStatus } : a)),
      );
    }
    if (action === 'disable_auto') {
      setArticles((prev) =>
        prev.map((a) => (a.id === article.id ? { ...a, auto_publish: false } : a)),
      );
    }
    try {
      const updated = await sendPatch(article, {
        action,
        reason,
        ...(articlePatch ? { article: articlePatch } : {}),
      });
      if (updated) applyArticle(updated);
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setArticles(previous);
      alert(err instanceof Error && err.message ? err.message : 'Action impossible.');
    }
  }

  async function handleReject(article: Article, articlePatch?: EditForm | null) {
    const reason = window.prompt(
      'Motif du rejet (facultatif, visible dans le journal) :',
      'Sujet non retenu par la rédaction.',
    );
    if (reason === null) return;
    await handleAction(article, 'reject', reason.trim() || undefined, articlePatch);
  }

  async function handleSave(article: Article, options: { publish?: boolean; close?: boolean } = {}) {
    if (!form) return;
    try {
      const updated = await sendPatch(article, {
        article: form,
        ...(options.publish ? { action: 'publish' } : {}),
      });
      if (updated) applyArticle(updated);
      if (options.close) closeEditor();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      alert(err instanceof Error && err.message ? err.message : 'Enregistrement impossible.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer définitivement cet article ?')) return;
    const previous = articles;
    const previousTotal = total;
    setArticles((prev) => prev.filter((a) => a.id !== id));
    setTotal((t) => Math.max(0, t - 1));
    try {
      const res = await fetch(`/api/cz7tk/articles/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        setArticles(previous);
        setTotal(previousTotal);
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setArticles(previous);
      setTotal(previousTotal);
      alert(err instanceof Error && err.message ? err.message : 'Suppression impossible.');
    }
  }

  async function loadAutomation() {
    setAutomationBusy(true);
    setAutomationNotice(null);
    try {
      const res = await fetch('/api/cz7tk/news', { cache: 'no-store' });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      const data = (await res.json()) as AutomationPayload;
      setAutomation(data);
      setSettingsDraft(data.settings);
    } catch (err) {
      setAutomationNotice(
        err instanceof Error && err.message ? err.message : 'Chargement impossible.',
      );
    } finally {
      setAutomationBusy(false);
    }
  }

  async function toggleAutomation() {
    const next = !automationOpen;
    setAutomationOpen(next);
    if (next && !automation) await loadAutomation();
  }

  async function saveSettings(patch?: Partial<NewsAutomationSettings>) {
    if (!settingsDraft) return;
    setAutomationBusy(true);
    setAutomationNotice(null);
    try {
      const res = await fetch('/api/cz7tk/news', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { ...settingsDraft, ...patch } }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      if (data.settings) {
        setSettingsDraft(data.settings);
        setAutomation((prev) => (prev ? { ...prev, settings: data.settings } : prev));
      }
      setAutomationNotice('Réglages enregistrés.');
    } catch (err) {
      setAutomationNotice(
        err instanceof Error && err.message ? err.message : 'Enregistrement impossible.',
      );
    } finally {
      setAutomationBusy(false);
    }
  }

  async function toggleSource(
    source: NewsSource,
    patch: Partial<Pick<NewsSource, 'enabled' | 'allowed_for_citation'>>,
  ) {
    setAutomationBusy(true);
    setAutomationNotice(null);
    try {
      const res = await fetch('/api/cz7tk/news', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId: source.id, source: patch }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      if (data.source) {
        setAutomation((prev) =>
          prev
            ? {
                ...prev,
                sources: prev.sources.map((item) =>
                  item.id === data.source.id ? (data.source as NewsSource) : item,
                ),
              }
            : prev,
        );
      }
    } catch (err) {
      setAutomationNotice(
        err instanceof Error && err.message ? err.message : 'Modification de source impossible.',
      );
    } finally {
      setAutomationBusy(false);
    }
  }

  async function triggerCollect() {
    setAutomationBusy(true);
    setAutomationNotice('Collecte en cours…');
    try {
      const res = await fetch('/api/cz7tk/news/collect', { method: 'POST' });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Erreur serveur (${res.status}).`);
      setAutomationNotice(
        `Collecte ${data.status} : ${data.itemsNew ?? 0} élément(s) nouveau(x), ` +
          `${data.clusters ?? 0} sujet(s), ${data.articlesCreated ?? 0} article(s), ` +
          `${data.aiCalls ?? 0} appel(s) IA.`,
      );
      await loadAutomation();
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setAutomationNotice(
        err instanceof Error && err.message ? err.message : 'Collecte impossible.',
      );
    } finally {
      setAutomationBusy(false);
    }
  }

  const stats = automation?.stats ?? null;

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl lg:text-3xl font-extrabold tracking-tight text-white">
            Modération Actualités
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Les articles produits automatiquement attendent {automation?.settings.review_minutes ?? 15}{' '}
            minutes avant publication. Une action administrateur est toujours prioritaire.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={toggleAutomation}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-300 transition-all hover:bg-slate-800"
          >
            ⚙️ Automatisation
          </button>
          <Link
            href="/actualites"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-300 transition-all hover:bg-slate-800"
          >
            /actualites ↗
          </Link>
        </div>
      </div>

      {/* Console d'automatisation */}
      {automationOpen && (
        <section className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
                Pipeline d&apos;actualités
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Collecte RSS toutes les {settingsDraft?.collect_interval_hours ?? 3} h · publication
                différée contrôlée toutes les minutes côté Supabase.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={triggerCollect}
                disabled={automationBusy}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-60"
              >
                Lancer une collecte
              </button>
              <button
                type="button"
                onClick={loadAutomation}
                disabled={automationBusy}
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 disabled:opacity-60"
              >
                Rafraîchir
              </button>
            </div>
          </div>

          {automationNotice && (
            <p className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs text-slate-300">
              {automationNotice}
            </p>
          )}

          {!settingsDraft ? (
            <p className="text-xs text-slate-500">
              {automationBusy ? 'Chargement…' : 'Console indisponible.'}
            </p>
          ) : (
            <>
              {/* Interrupteurs globaux */}
              <div className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { key: 'enabled', label: 'Automatisation globale' },
                    { key: 'auto_publish_enabled', label: 'Publication automatique' },
                  ] as Array<{ key: 'enabled' | 'auto_publish_enabled'; label: string }>
                ).map((item) => (
                  <label
                    key={item.key}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3"
                  >
                    <span className="text-xs font-semibold text-slate-200">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(settingsDraft[item.key])}
                      onChange={(event) => {
                        const value = event.target.checked;
                        setSettingsDraft((prev) =>
                          prev ? { ...prev, [item.key]: value } : prev,
                        );
                        void saveSettings({ [item.key]: value });
                      }}
                      className="h-4 w-4 accent-sky-500"
                    />
                  </label>
                ))}
              </div>

              {/* Réglages numériques */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {NUMERIC_SETTINGS.map((setting) => (
                  <label key={setting.key} className="text-[11px] text-slate-400">
                    {setting.label}
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        type="number"
                        min={setting.min}
                        max={setting.max}
                        value={Number(settingsDraft[setting.key])}
                        onChange={(event) =>
                          setSettingsDraft((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  [setting.key]: Number(event.target.value),
                                }
                              : prev,
                          )
                        }
                        className="w-full rounded-xl border border-slate-800 bg-slate-900 px-2.5 py-2 text-xs text-white outline-none focus:border-primary"
                      />
                      {setting.suffix && (
                        <span className="shrink-0 text-[10px] text-slate-500">{setting.suffix}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => saveSettings()}
                  disabled={automationBusy}
                  className="rounded-xl bg-brand px-5 py-2.5 text-xs font-bold text-slate-950 disabled:opacity-60"
                >
                  Enregistrer les réglages
                </button>
              </div>

              {/* Statistiques */}
              {stats && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
                  {[
                    { label: 'En attente', value: stats.pending },
                    { label: 'Publiés', value: stats.published },
                    { label: 'Archivés', value: stats.archived },
                    { label: 'Rejetés', value: stats.rejected },
                    { label: 'Publiés aujourd’hui', value: stats.publishedToday },
                    { label: 'Appels IA (jour)', value: stats.aiCallsToday },
                    { label: 'Dernière collecte', value: formatDateTime(stats.lastRun?.started_at ?? null) },
                    { label: 'Vues cumulées', value: stats.totalViews },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-2.5"
                    >
                      <div className="text-sm font-extrabold text-white">{item.value}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-500">
                        {item.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Sources */}
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Sources RSS
                </h3>
                <div className="overflow-x-auto rounded-2xl border border-slate-800">
                  <table className="w-full min-w-[560px] text-left text-xs">
                    <thead className="bg-slate-900/60 text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Source</th>
                        <th className="px-3 py-2">Activée</th>
                        <th className="px-3 py-2">Citable</th>
                        <th className="px-3 py-2">Dernier état</th>
                        <th className="px-3 py-2">Erreur</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {(automation?.sources ?? []).map((source) => (
                        <tr key={source.id}>
                          <td className="px-3 py-2">
                            <div className="font-semibold text-white">{source.name}</div>
                            <div className="truncate text-[10px] text-slate-500">{source.feed_url}</div>
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={source.enabled}
                              disabled={automationBusy}
                              onChange={(event) =>
                                toggleSource(source, { enabled: event.target.checked })
                              }
                              className="h-4 w-4 accent-sky-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={source.allowed_for_citation}
                              disabled={automationBusy || !source.enabled}
                              onChange={(event) =>
                                toggleSource(source, {
                                  allowed_for_citation: event.target.checked,
                                })
                              }
                              className="h-4 w-4 accent-brand"
                            />
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {source.last_status ?? '—'} · {formatDateTime(source.last_fetched_at)}
                          </td>
                          <td className="max-w-[200px] px-3 py-2 text-rose-400">
                            <span className="line-clamp-2">{source.last_error || '—'}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dernières exécutions */}
              {(automation?.runs ?? []).length > 0 && (
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                    Dernières collectes
                  </h3>
                  <ul className="space-y-2">
                    {(automation?.runs ?? []).map((run) => (
                      <li
                        key={run.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] text-slate-400"
                      >
                        <span className="font-semibold text-slate-200">
                          {formatDateTime(run.started_at)}
                        </span>
                        <span
                          className={
                            run.status === 'success'
                              ? 'text-brand'
                              : run.status === 'error'
                                ? 'text-rose-400'
                                : 'text-amber-400'
                          }
                        >
                          {run.status}
                        </span>
                        <span>{run.trigger}</span>
                        <span>{run.items_new} nouveaux</span>
                        <span>{run.articles_created} article(s)</span>
                        <span>{run.ai_calls} appel(s) IA</span>
                        <span>{run.duration_ms ? `${Math.round(run.duration_ms / 1000)} s` : '—'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* Onglets de statut */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              statusFilter === tab.value
                ? tab.activeClass
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-[10px] text-white">
              {statusCount(tab.value)}
            </span>
          </button>
        ))}
      </div>

      {/* Recherche */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
        <div className="relative w-full md:w-96">
          <svg
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par titre, catégorie, source…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 py-3 pl-11 pr-4 text-sm text-white transition-colors focus:border-primary focus:outline-none"
          />
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          {total} article(s) au total · {statusCount('pending_review')} en attente de validation.
        </p>
      </div>

      {/* Tableau */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="sticky left-0 z-10 bg-slate-900/50 px-3 py-3 sm:px-6 sm:py-4">
                  Article
                </th>
                <th className="hidden px-3 py-3 sm:px-6 sm:py-4 lg:table-cell">Catégorie</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4">Statut</th>
                <th className="px-3 py-3 sm:px-6 sm:py-4">Échéance</th>
                <th className="hidden px-3 py-3 sm:px-6 sm:py-4 sm:table-cell">Créé le</th>
                <th className="px-3 py-3 text-right sm:px-6 sm:py-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-500">
                    Aucun article dans cette catégorie.
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => {
                  const badge = STATUS_BADGES[article.status];
                  const remaining =
                    article.status === 'pending_review'
                      ? formatRemaining(article.review_deadline ?? null, now)
                      : null;
                  const isDue = remaining === 'Échéance atteinte';
                  const sources = (article.sources ?? []).filter((source) => source.allowed_for_citation !== false);
                  return (
                    <tr key={article.id} className="transition-colors hover:bg-slate-900/40">
                      <td className="sticky left-0 z-10 bg-slate-950 px-3 py-3 hover:bg-slate-900/40 sm:px-6 sm:py-4">
                        <div className="min-w-0">
                          <div className="max-w-[260px] truncate font-bold text-white sm:max-w-md">
                            {article.title}
                          </div>
                          <div className="truncate text-[10px] text-slate-400 sm:text-xs">
                            {article.author}
                            {sources.length > 0 ? ` · ${sources.length} source(s)` : ''}
                            {article.ai_confidence != null
                              ? ` · confiance ${Math.round(article.ai_confidence * 100)}%`
                              : ''}
                          </div>
                          {article.status === 'pending_review' && article.validation_error && (
                            <div className="mt-1 max-w-sm text-[10.5px] text-rose-400">
                              ⛔ {article.validation_error}
                            </div>
                          )}
                          {article.status === 'rejected' && article.rejection_reason && (
                            <div className="mt-1 max-w-sm text-[10.5px] text-slate-500">
                              Motif : {article.rejection_reason}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="hidden px-3 py-3 sm:px-6 sm:py-4 lg:table-cell">
                        <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                          {CATEGORY_LABELS[article.category] || article.category}
                        </span>
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:text-xs ${badge.className}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-4">
                        {article.status !== 'pending_review' ? (
                          <span className="text-xs text-slate-500">—</span>
                        ) : article.auto_publish === false ? (
                          <span className="text-[11px] font-semibold text-slate-400">
                            Auto désactivée
                          </span>
                        ) : isDue ? (
                          <span className="text-[11px] font-semibold text-amber-400">
                            Contrôle en cours
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-bold text-sky-300">
                            ⏱ {remaining}
                          </span>
                        )}
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-3 text-xs text-slate-300 sm:px-6 sm:py-4 sm:table-cell">
                        {formatDate(article.created_at)}
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-4">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditor(article)}
                            className="rounded-xl bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold text-slate-200 hover:bg-slate-700 sm:text-xs"
                          >
                            Ouvrir
                          </button>
                          {article.status !== 'published' && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleAction(article, 'publish')}
                              className="rounded-xl border border-brand/20 bg-brand/10 px-2.5 py-1.5 text-[10px] font-bold text-brand hover:bg-brand/20 disabled:opacity-60 sm:text-xs"
                            >
                              Publier
                            </button>
                          )}
                          {article.status === 'pending_review' && article.auto_publish !== false && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleAction(article, 'disable_auto')}
                              className="rounded-xl bg-slate-800 px-2.5 py-1.5 text-[10px] font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-60 sm:text-xs"
                            >
                              Stop auto
                            </button>
                          )}
                          {article.status !== 'rejected' && article.status !== 'archived' && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleReject(article)}
                              className="rounded-xl bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-400 hover:bg-rose-500/20 disabled:opacity-60 sm:text-xs"
                            >
                              Rejeter
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(article.id)}
                            className="rounded-xl bg-rose-500/10 px-2.5 py-1.5 text-[10px] font-semibold text-rose-400 hover:bg-rose-500/20 sm:text-xs"
                          >
                            Suppr.
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

      {/* Modal édition / lecture */}
      {editing && form && (
        <div className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm">
          <div className="mx-4 my-8 w-full max-w-4xl space-y-5 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl lg:p-8">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="min-w-0">
                <h3 className="font-[var(--font-display)] text-xl font-bold text-white">
                  {editing.status === 'pending_review' ? 'Validation de l’article' : 'Article'}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Statut : {STATUS_BADGES[editing.status].label} · créé le{' '}
                  {formatDate(editing.created_at)}
                  {editing.review_deadline
                    ? ` · échéance ${formatDateTime(editing.review_deadline)}`
                    : ''}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewMode((prev) => !prev)}
                  className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
                >
                  {previewMode ? 'Éditer' : 'Aperçu'}
                </button>
                <button
                  type="button"
                  onClick={closeEditor}
                  className="text-xl font-bold text-slate-400 hover:text-white"
                  aria-label="Fermer"
                >
                  &times;
                </button>
              </div>
            </div>

            {editing.validation_error && (
              <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">
                Contrôle automatique bloqué : {editing.validation_error}
              </p>
            )}
            {editing.rejection_reason && (
              <p className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs text-slate-400">
                Motif du rejet : {editing.rejection_reason}
              </p>
            )}

            {previewMode ? (
              <div className="space-y-4">
                <h4 className="text-lg font-bold text-white">{form.title}</h4>
                {form.excerpt && (
                  <p className="border-l-2 border-primary pl-3 text-sm italic text-slate-300">
                    {form.excerpt}
                  </p>
                )}
                <div className="max-h-[50vh] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950 p-5 text-sm text-slate-300">
                  <SimpleMarkdown text={form.content} />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Titre
                  <input
                    type="text"
                    value={form.title}
                    maxLength={200}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-normal text-white outline-none focus:border-primary"
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Catégorie
                    <select
                      value={form.category}
                      onChange={(event) => setForm({ ...form, category: event.target.value })}
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-normal text-white outline-none focus:border-primary"
                    >
                      {NEWS_CATEGORIES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Image de couverture (URL)
                    <input
                      type="url"
                      value={form.cover_image}
                      onChange={(event) => setForm({ ...form, cover_image: event.target.value })}
                      placeholder="https://…"
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-normal text-white outline-none focus:border-primary"
                    />
                  </label>
                </div>

                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Résumé
                  <textarea
                    value={form.excerpt}
                    maxLength={400}
                    rows={3}
                    onChange={(event) => setForm({ ...form, excerpt: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-normal text-white outline-none focus:border-primary"
                  />
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Contenu (Markdown)
                  <textarea
                    value={form.content}
                    rows={14}
                    onChange={(event) => setForm({ ...form, content: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 font-mono text-[12.5px] leading-relaxed text-white outline-none focus:border-primary"
                  />
                </label>

                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Source principale (URL)
                  <input
                    type="url"
                    value={form.source_url}
                    onChange={(event) => setForm({ ...form, source_url: event.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-normal text-white outline-none focus:border-primary"
                  />
                </label>
              </div>
            )}

            {/* Sources vérifiables */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
              <h4 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Sources vérifiées ({(editing.sources ?? []).length})
              </h4>
              {(editing.sources ?? []).length === 0 ? (
                <p className="mt-2 text-xs text-rose-400">
                  Aucune source structurée : la publication automatique sera refusée.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {(editing.sources ?? []).map((source, index) => (
                    <li key={`${source.url}-${index}`} className="text-xs text-slate-400">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-sky-300 hover:underline"
                      >
                        {source.name} ↗
                      </a>
                      {source.published_at ? ` · ${formatDate(source.published_at)}` : ''}
                      {source.allowed_for_citation === false ? ' · non citable' : ''}
                      {source.title ? (
                        <span className="block truncate text-[10.5px] text-slate-500">
                          {source.title}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => handleReject(editing, form)}
                className="rounded-2xl bg-rose-500/10 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-500/20"
              >
                Rejeter
              </button>
              {editing.status === 'pending_review' && editing.auto_publish !== false && (
                <button
                  type="button"
                  onClick={() => handleAction(editing, 'disable_auto', undefined, form)}
                  className="rounded-2xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-300 hover:bg-slate-700"
                >
                  Désactiver l’auto-publication
                </button>
              )}
              <button
                type="button"
                onClick={() => handleSave(editing, { close: true })}
                className="rounded-2xl bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={() => handleSave(editing, { publish: true, close: true })}
                className="rounded-2xl bg-brand px-5 py-2.5 text-xs font-bold text-slate-950 shadow-lg shadow-brand/20 hover:brightness-110"
              >
                Publier maintenant
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

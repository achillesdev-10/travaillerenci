'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Article, ArticleStatus } from '@/types/article';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';

const STATUS_TABS: Array<{ value: ArticleStatus | 'all'; label: string; activeClass: string }> = [
  { value: 'all', label: 'Tous', activeClass: 'bg-primary text-slate-950' },
  { value: 'draft', label: 'Brouillons', activeClass: 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' },
  { value: 'published', label: 'Publiés', activeClass: 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' },
  { value: 'archived', label: 'Archivés', activeClass: 'bg-slate-700 text-white' },
];

const STATUS_BADGES: Record<ArticleStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Brouillon', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  published: { label: 'Publié', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  archived: { label: 'Archivé', className: 'bg-slate-700/30 text-slate-400 border-slate-600/30', dot: 'bg-slate-400' },
};

const CATEGORY_LABELS: Record<string, string> = {
  emploi: 'Emploi',
  formation: 'Formation',
  concours: 'Concours',
  economie: 'Économie',
  carriere: 'Carrière',
  guide: 'Guide',
};

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
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | 'all'>('all');
  const [previewing, setPreviewing] = useState<Article | null>(null);
  const [isPending, startTransition] = useTransition();

  async function readError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error) return data.error;
    } catch { /* noop */ }
    return `Erreur serveur (${res.status}).`;
  }

  function redirectToLogin() {
    router.replace('/cz7tk/login?next=/cz7tk/actualites');
  }

  const filteredArticles = useMemo(() => {
    const q = search.toLowerCase();
    return articles.filter((a) => {
      const matchesStatus = statusFilter === 'all' ? true : a.status === statusFilter;
      const matchesSearch =
        !q || a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [articles, statusFilter, search]);

  const statusCount = (s: ArticleStatus | 'all') =>
    s === 'all' ? articles.length : articles.filter((a) => a.status === s).length;

  async function handleQuickStatus(article: Article, status: ArticleStatus) {
    const previous = articles;
    setArticles((prev) =>
      prev.map((a) => (a.id === article.id ? { ...a, status } : a)),
    );
    try {
      const res = await fetch(`/api/cz7tk/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        setArticles(previous);
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      const data = await res.json();
      if (data.article) {
        setArticles((prev) =>
          prev.map((a) => (a.id === article.id ? { ...a, ...data.article } : a)),
        );
      }
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setArticles(previous);
      alert(
        err instanceof Error && err.message
          ? err.message
          : 'Impossible de modifier le statut.',
      );
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
      alert(
        err instanceof Error && err.message
          ? err.message
          : 'Impossible de supprimer cet article.',
      );
    }
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
            Modération Actualités
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Validez les articles du pipeline news avant publication sur{' '}
            <a
              href="/actualites"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline"
            >
              /actualites ↗
            </a>
            {' '}— {total} article(s) au total.
          </p>
        </div>
        <Link
          href="/cz7tk/blog"
          className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-all"
        >
          ✍️ Blog
        </Link>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              statusFilter === tab.value
                ? tab.activeClass
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span className="bg-slate-950/40 px-2 py-0.5 rounded-full text-[10px] text-white">
              {statusCount(tab.value)}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
        <div className="w-full md:w-96 relative">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
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
            placeholder="Rechercher par titre, catégorie…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[520px]">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-3 px-3 sm:py-4 sm:px-6 sticky left-0 z-10 bg-slate-900/50">
                  Article
                </th>
                <th className="py-3 px-3 sm:py-4 sm:px-6 hidden lg:table-cell">Catégorie</th>
                <th className="py-3 px-3 sm:py-4 sm:px-6">Statut</th>
                <th className="py-3 px-3 sm:py-4 sm:px-6 hidden sm:table-cell">Créé le</th>
                <th className="py-3 px-3 sm:py-4 sm:px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredArticles.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    Aucun article trouvé.
                  </td>
                </tr>
              ) : (
                filteredArticles.map((article) => {
                  const badge = STATUS_BADGES[article.status];
                  return (
                    <tr key={article.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-3 sm:py-4 sm:px-6 sticky left-0 z-10 bg-slate-950 hover:bg-slate-900/40">
                        <div className="min-w-0">
                          <div className="font-bold text-white truncate max-w-[180px] sm:max-w-md">
                            {article.title}
                          </div>
                          <div className="text-[10px] sm:text-xs text-slate-400 truncate">
                            {article.author}
                            {article.source_url ? ' · source ↗' : ''}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6 hidden lg:table-cell">
                        <span className="inline-flex rounded-full bg-slate-800 px-2 sm:px-2.5 py-0.5 sm:py-1 text-[10px] font-semibold text-slate-300">
                          {CATEGORY_LABELS[article.category] || article.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full text-[10px] sm:text-xs font-semibold border ${badge.className}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6 text-xs text-slate-300 whitespace-nowrap hidden sm:table-cell">
                        {formatDate(article.created_at)}
                      </td>
                      <td className="py-3 px-3 sm:py-4 sm:px-6 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5">
                          <button
                            type="button"
                            onClick={() => setPreviewing(article)}
                            className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-[10px] sm:text-xs font-semibold"
                          >
                            Aperçu
                          </button>
                          {article.status === 'published' && (
                            <a
                              href={`/actualites/${article.slug}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-[10px] sm:text-xs font-semibold"
                            >
                              Voir
                            </a>
                          )}
                          {article.status !== 'published' && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleQuickStatus(article, 'published')}
                              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-[10px] sm:text-xs font-bold border border-emerald-500/20 disabled:opacity-60"
                            >
                              Publier
                            </button>
                          )}
                          {article.status === 'published' && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleQuickStatus(article, 'draft')}
                              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-[10px] sm:text-xs font-bold border border-amber-500/20 disabled:opacity-60"
                            >
                              Dépublier
                            </button>
                          )}
                          {article.status !== 'archived' && (
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => handleQuickStatus(article, 'archived')}
                              className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 text-[10px] sm:text-xs font-semibold"
                            >
                              Archiver
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(article.id)}
                            className="px-2 sm:px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-[10px] sm:text-xs font-semibold"
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

      {/* Modal aperçu (lecture seule) */}
      {previewing && (
        <div className="fixed inset-0 z-50 flex justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:p-8 shadow-2xl space-y-5 my-8 mx-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white font-[var(--font-display)]">
                  {previewing.title}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {CATEGORY_LABELS[previewing.category] || previewing.category} ·{' '}
                  {previewing.author} · créé le {formatDate(previewing.created_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewing(null)}
                className="text-slate-400 hover:text-white text-xl font-bold"
                aria-label="Fermer l'aperçu"
              >
                &times;
              </button>
            </div>

            {previewing.excerpt && (
              <p className="text-sm text-slate-300 italic border-l-2 border-primary pl-3">
                {previewing.excerpt}
              </p>
            )}

            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 max-h-[50vh] overflow-y-auto text-sm text-slate-300">
              <SimpleMarkdown text={previewing.content} />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-800 pt-4">
              {previewing.source_url && (
                <a
                  href={previewing.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-2xl bg-slate-800 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Source originale ↗
                </a>
              )}
              {previewing.status !== 'published' && (
                <button
                  type="button"
                  onClick={() => {
                    handleQuickStatus(previewing, 'published');
                    setPreviewing(null);
                  }}
                  className="rounded-2xl bg-emerald-500 px-6 py-3 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-emerald-500/20"
                >
                  Publier
                </button>
              )}
              <button
                type="button"
                onClick={() => setPreviewing(null)}
                className="rounded-2xl bg-slate-800 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

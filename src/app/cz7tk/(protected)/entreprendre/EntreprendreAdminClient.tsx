'use client';

import { useMemo, useState, useRef, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type {
  EntreprendreArticle,
  EntreprendreArticleStatus,
  EntreprendreSector,
  BudgetRange,
} from '@/types/entreprendre';
import { slugify } from '@/lib/slugify';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';

const STATUS_TABS: Array<{ value: EntreprendreArticleStatus | 'all'; label: string; activeClass: string }> = [
  { value: 'all', label: 'Tous', activeClass: 'bg-primary text-slate-950' },
  { value: 'draft', label: 'Brouillons', activeClass: 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' },
  { value: 'published', label: 'Publiés', activeClass: 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' },
  { value: 'archived', label: 'Archivés', activeClass: 'bg-slate-700 text-white' },
];

const STATUS_BADGES: Record<EntreprendreArticleStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Brouillon', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  published: { label: 'Publié', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  archived: { label: 'Archivé', className: 'bg-slate-700/30 text-slate-400 border-slate-600/30', dot: 'bg-slate-400' },
};

const SECTOR_LABELS: Record<EntreprendreSector, string> = {
  restauration: 'Restauration',
  'coiffure-beaute': 'Coiffure & Beauté',
  'commerce-grossiste': 'Commerce de gros',
  'commerce-detail': 'Commerce de détail',
  agroalimentaire: 'Agroalimentaire',
  'it-digital': 'IT / Digital',
  'transport-logistique': 'Transport & Logistique',
  'btp-immobilier': 'BTP & Immobilier',
  sante: 'Santé',
  'education-formation': 'Éducation & Formation',
  'tourisme-hotellerie': 'Tourisme & Hôtellerie',
  artisanat: 'Artisanat',
  'services-professionnels': 'Services professionnels',
  agriculture: 'Agriculture',
  autre: 'Autre',
};

const BUDGET_LABELS: Record<BudgetRange, string> = {
  petit: 'Petit budget',
  moyen: 'Budget moyen',
  gros: 'Gros investissement',
};

function toDatetimeLocal(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

interface EditForm {
  title: string;
  slug: string;
  author: string;
  status: EntreprendreArticleStatus;
  published_at: string;
  excerpt: string;
  cover_image: string;
  sector: EntreprendreSector;
  budget_range: BudgetRange;
  reading_time: number;
  featured: boolean;
  meta_description: string;
  content: string;
}

const EMPTY_FORM: EditForm = {
  title: '',
  slug: '',
  author: 'TravaillerenCi',
  status: 'draft',
  published_at: '',
  excerpt: '',
  cover_image: '',
  sector: 'autre',
  budget_range: 'petit',
  reading_time: 5,
  featured: false,
  meta_description: '',
  content: '',
};

export default function EntreprendreAdminClient({
  initialArticles,
}: {
  initialArticles: EntreprendreArticle[];
}) {
  const router = useRouter();
  const [articles, setArticles] = useState<EntreprendreArticle[]>(initialArticles);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<EntreprendreArticleStatus | 'all'>('all');
  const [isPending, startTransition] = useTransition();

  const [editingArticle, setEditingArticle] = useState<EntreprendreArticle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [modalNotice, setModalNotice] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);
  const [imageUploading, setImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function readError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error) return data.error;
    } catch { /* noop */ }
    return `Erreur serveur (${res.status}).`;
  }

  function redirectToLogin() {
    router.replace('/cz7tk/login?next=/cz7tk/entreprendre');
  }

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      const matchesStatus = statusFilter === 'all' ? true : a.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch = !q || a.title.toLowerCase().includes(q) || a.author.toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [articles, statusFilter, search]);

  const statusCount = (s: EntreprendreArticleStatus | 'all') =>
    s === 'all' ? articles.length : articles.filter((a) => a.status === s).length;

  function closeModal() {
    setEditingArticle(null);
    setIsCreating(false);
    setModalNotice(null);
    setPreviewMode(false);
  }

  function openCreateModal() {
    setEditingArticle(null);
    setIsCreating(true);
    setModalNotice(null);
    setPreviewMode(false);
    setForm({ ...EMPTY_FORM, slug: '' });
  }

  function openEditModal(article: EntreprendreArticle) {
    setEditingArticle(article);
    setIsCreating(false);
    setModalNotice(null);
    setPreviewMode(false);
    setForm({
      title: article.title,
      slug: article.slug,
      author: article.author,
      status: article.status,
      published_at: toDatetimeLocal(article.published_at),
      excerpt: article.excerpt || '',
      cover_image: article.cover_image || '',
      sector: article.sector,
      budget_range: article.budget_range,
      reading_time: article.reading_time,
      featured: article.featured,
      meta_description: article.meta_description || '',
      content: article.content,
    });
  }

  function handleTitleChange(value: string) {
    setForm((f) => ({
      ...f,
      title: value,
      slug: isCreating && (!f.slug || f.slug === slugify(f.title)) ? slugify(value) : f.slug,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingArticle && !isCreating) return;
    try {
      const res = await fetch(
        isCreating ? '/api/cz7tk/entreprendre' : `/api/cz7tk/entreprendre/${editingArticle!.id}`,
        {
          method: isCreating ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        },
      );
      const data = await res.json();
      if (res.status === 401) { closeModal(); redirectToLogin(); return; }
      if (!res.ok) throw new Error(data.error || 'Erreur');
      if (isCreating && data.article) {
        setArticles((prev) => [data.article, ...prev]);
      } else if (!isCreating && editingArticle) {
        setArticles((prev) => prev.map((a) => (a.id === editingArticle.id ? { ...a, ...data.article } : a)));
      }
      closeModal();
      startTransition(() => { router.refresh(); });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/admin/entreprendre/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.status === 401) { redirectToLogin(); return; }
      if (!res.ok) throw new Error(data.error || 'Erreur upload');
      const md = `![${file.name.replace(/\.[^.]+$/, '')}](${data.url})`;
      setForm((f) => ({ ...f, content: f.content ? f.content + '\n\n' + md : md }));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur lors de l\'upload de l\'image');
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleQuickStatus(article: EntreprendreArticle, status: EntreprendreArticleStatus) {
    const previous = articles;
    setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, status } : a)));
    try {
      const res = await fetch(`/api/cz7tk/entreprendre/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) { setArticles(previous); redirectToLogin(); return; }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      setArticles(previous);
      alert(err instanceof Error && err.message ? err.message : 'Impossible de modifier le statut.');
    }
  }

  async function handleToggleFeatured(article: EntreprendreArticle) {
    const previous = articles;
    setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, featured: !a.featured } : a)));
    try {
      const res = await fetch(`/api/cz7tk/entreprendre/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ featured: !article.featured }),
      });
      if (res.status === 401) { setArticles(previous); redirectToLogin(); return; }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      setArticles(previous);
      alert(err instanceof Error && err.message ? err.message : 'Impossible de modifier la mise en avant.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) return;
    const previous = articles;
    setArticles((prev) => prev.filter((a) => a.id !== id));
    try {
      const res = await fetch(`/api/cz7tk/entreprendre/${id}`, { method: 'DELETE' });
      if (res.status === 401) { setArticles(previous); redirectToLogin(); return; }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      setArticles(previous);
      alert(err instanceof Error && err.message ? err.message : 'Impossible de supprimer l\'article.');
    }
  }

  const inputClass = 'w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors';
  const labelClass = 'block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1';

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
            Gestion Entreprendre
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Rédigez et publiez des guides business (
            <a href="/entreprendre" target="_blank" rel="noreferrer" className="text-primary hover:underline">voir la section ↗</a>
            ).
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href="/cz7tk/entreprendre/comments"
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-300 hover:bg-slate-800 transition-all"
          >
            💬 Commentaires
          </a>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Nouvel article
          </button>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setStatusFilter(tab.value)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              statusFilter === tab.value ? tab.activeClass : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span className="bg-slate-950/40 px-2 py-0.5 rounded-full text-[10px] text-white">{statusCount(tab.value)}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
        <div className="w-full md:w-96 relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par titre, auteur…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">Article</th>
                <th className="py-4 px-6">Secteur</th>
                <th className="py-4 px-6">Statut</th>
                <th className="py-4 px-6">Stats</th>
                <th className="py-4 px-6">Publié le</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredArticles.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500">Aucun article trouvé.</td></tr>
              ) : (
                filteredArticles.map((article) => {
                  const badge = STATUS_BADGES[article.status];
                  return (
                    <tr key={article.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-bold text-white truncate max-w-xs">{article.title}</div>
                            {article.featured && <span className="text-amber-400 text-xs">⭐</span>}
                          </div>
                          <div className="text-xs text-slate-400 truncate">/entreprendre/{article.slug}</div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-slate-300">
                          {SECTOR_LABELS[article.sector as EntreprendreSector] || article.sector}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${badge.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-300 whitespace-nowrap">
                        👁 {article.view_count} · 👍 {article.helpful_count}
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-300 whitespace-nowrap">
                        {formatDate(article.status === 'published' ? article.published_at : article.updated_at)}
                      </td>
                      <td className="py-4 px-6 text-right space-x-1.5 whitespace-nowrap">
                        {article.status === 'published' && (
                          <a href={`/entreprendre/${article.slug}`} target="_blank" rel="noreferrer"
                            className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold">Voir</a>
                        )}
                        {article.status !== 'published' && (
                          <button type="button" onClick={() => handleQuickStatus(article, 'published')}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20">Publier</button>
                        )}
                        {article.status === 'published' && (
                          <button type="button" onClick={() => handleQuickStatus(article, 'draft')}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold border border-amber-500/20">Dépublier</button>
                        )}
                        <button type="button" onClick={() => handleToggleFeatured(article)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold ${article.featured ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>
                          {article.featured ? '⭐' : '☆'}
                        </button>
                        <button type="button" onClick={() => openEditModal(article)}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold">Éditer</button>
                        <button type="button" onClick={() => handleDelete(article.id)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold">Supprimer</button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {(editingArticle || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white font-[var(--font-display)]">
                  {isCreating ? 'Nouvel article' : 'Modifier l\'article'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Rédigez en Markdown simple (## titres, puces, **gras**).</p>
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">1. Informations</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Titre</label>
                    <input type="text" required value={form.title} onChange={(e) => handleTitleChange(e.target.value)} className={inputClass} placeholder="Comment ouvrir un salon de coiffure" />
                  </div>
                  <div>
                    <label className={labelClass}>Slug</label>
                    <div className="flex gap-2">
                      <input type="text" value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} className={inputClass} placeholder="comment-ouvrir-salon-coiffure" />
                      <button type="button" onClick={() => setForm({ ...form, slug: slugify(form.title) })} title="Générer depuis le titre"
                        className="shrink-0 rounded-2xl border border-slate-800 bg-slate-800 px-3 text-slate-200 hover:bg-slate-700 text-xs font-bold transition-colors">Auto</button>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 ml-1">/entreprendre/{form.slug || '…'}</p>
                  </div>
                  <div>
                    <label className={labelClass}>Auteur</label>
                    <input type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Statut</label>
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as EntreprendreArticleStatus })} className={inputClass}>
                      <option value="draft">Brouillon</option>
                      <option value="published">Publié</option>
                      <option value="archived">Archivé</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Secteur d&apos;activité</label>
                    <select value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value as EntreprendreSector })} className={inputClass}>
                      {Object.entries(SECTOR_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Budget de démarrage</label>
                    <select value={form.budget_range} onChange={(e) => setForm({ ...form, budget_range: e.target.value as BudgetRange })} className={inputClass}>
                      {Object.entries(BUDGET_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Temps de lecture (min)</label>
                    <input type="number" min={1} max={120} value={form.reading_time} onChange={(e) => setForm({ ...form, reading_time: parseInt(e.target.value) || 5 })} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Date de publication</label>
                    <input type="datetime-local" value={form.published_at} onChange={(e) => setForm({ ...form, published_at: e.target.value ? new Date(e.target.value).toISOString() : '' })} className={inputClass} />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} className="sr-only peer" />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                  <span className="text-xs text-slate-300 font-semibold">⭐ Mettre en avant (à la une)</span>
                </div>

                <div>
                  <label className={labelClass}>Résumé</label>
                  <textarea rows={2} maxLength={300} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className={inputClass} placeholder="Une phrase qui donne envie de lire…" />
                  <div className="text-right text-[10px] text-slate-500 mt-1">{form.excerpt.length}/300</div>
                </div>

                <div>
                  <label className={labelClass}>Meta description SEO (optionnel — fallback sur résumé)</label>
                  <input type="text" maxLength={160} value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} className={inputClass} placeholder="Description pour les moteurs de recherche…" />
                  <div className="text-right text-[10px] text-slate-500 mt-1">{form.meta_description.length}/160</div>
                </div>

                <div>
                  <label className={labelClass}>Image de couverture (URL)</label>
                  <input type="url" value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} className={inputClass} placeholder="https://…" />
                  {form.cover_image && (
                    <div className="mt-2 rounded-2xl border border-slate-800 bg-slate-950 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.cover_image} alt="Aperçu" className="w-full h-40 object-cover rounded-xl" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 border-t border-slate-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-wider">2. Contenu (Markdown)</h4>
                  <div className="flex items-center gap-1 rounded-xl bg-slate-950 border border-slate-800 p-1">
                    <button type="button" onClick={() => setPreviewMode(false)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${!previewMode ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Écrire</button>
                    <button type="button" onClick={() => setPreviewMode(true)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${previewMode ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}>Aperçu</button>
                    <div className="w-px h-5 bg-slate-700 mx-0.5" />
                    <label className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors cursor-pointer ${imageUploading ? 'text-amber-400 animate-pulse' : 'text-slate-400 hover:text-white'}`}>
                      🖼 Image
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={imageUploading} onChange={handleImageUpload} />
                    </label>
                  </div>
                </div>
                <p className="text-[10px] text-slate-500 -mt-1">
                  💡 Insérez des images via le bouton « 🖼 Image » ou coller directement une URL Markdown : <code className="text-slate-400">![Légende](https://url)</code>
                </p>
                {modalNotice && <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">{modalNotice}</p>}
                {previewMode ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 min-h-[240px] text-slate-300 text-sm">
                    {form.content.trim() ? <SimpleMarkdown text={form.content} /> : <p className="text-slate-500 text-center py-10">Rien à prévisualiser.</p>}
                  </div>
                ) : (
                  <textarea rows={14} required value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className={`${inputClass} font-mono text-xs leading-relaxed`}
                    placeholder={'## Introduction\n\nVotre texte ici…\n\n- Point 1\n- Point 2\n\n**En gras** et *en italique*.'} />
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={closeModal} className="rounded-2xl bg-slate-800 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors">Annuler</button>
                <button type="submit" disabled={isPending}
                  className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-60">
                  {isCreating ? 'Créer l\'article' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

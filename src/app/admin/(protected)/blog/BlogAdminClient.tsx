'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { BlogPost, BlogPostStatus } from '@/types/blog';
import { slugify } from '@/lib/slugify';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';

const STATUS_TABS: Array<{ value: BlogPostStatus | 'all'; label: string; activeClass: string }> = [
  { value: 'all', label: 'Tous', activeClass: 'bg-primary text-slate-950' },
  { value: 'draft', label: 'Brouillons', activeClass: 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20' },
  { value: 'published', label: 'Publiés', activeClass: 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' },
  { value: 'archived', label: 'Archivés', activeClass: 'bg-slate-700 text-white' },
];

const STATUS_BADGES: Record<BlogPostStatus, { label: string; className: string; dot: string }> = {
  draft: { label: 'Brouillon', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  published: { label: 'Publié', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  archived: { label: 'Archivé', className: 'bg-slate-700/30 text-slate-400 border-slate-600/30', dot: 'bg-slate-400' },
};

/** ISO 8601 → valeur pour un <input type="datetime-local">. */
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

function tagList(tags: string | null): string[] {
  return (tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
}

interface EditForm {
  title: string;
  slug: string;
  author: string;
  status: BlogPostStatus;
  published_at: string;
  excerpt: string;
  cover_image: string;
  tags: string;
  content: string;
}

const EMPTY_FORM: EditForm = {
  title: '',
  slug: '',
  author: 'AchillesDev10',
  status: 'draft',
  published_at: '',
  excerpt: '',
  cover_image: '',
  tags: '',
  content: '',
};

export default function BlogAdminClient({
  initialPosts,
}: {
  initialPosts: BlogPost[];
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BlogPostStatus | 'all'>('all');
  const [isPending, startTransition] = useTransition();

  // Modal d'édition / création
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [modalNotice, setModalNotice] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [form, setForm] = useState<EditForm>(EMPTY_FORM);

  async function readError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error) return data.error;
    } catch {
      // réponse non-JSON
    }
    return `Erreur serveur (${res.status}).`;
  }

  function redirectToLogin() {
    router.replace('/admin/login?next=/admin/blog');
  }

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchesStatus =
        statusFilter === 'all' ? true : p.status === statusFilter;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.author.toLowerCase().includes(q) ||
        (p.tags || '').toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [posts, statusFilter, search]);

  const statusCount = (s: BlogPostStatus | 'all') =>
    s === 'all' ? posts.length : posts.filter((p) => p.status === s).length;

  function closeModal() {
    setEditingPost(null);
    setIsCreating(false);
    setModalNotice(null);
    setPreviewMode(false);
  }

  function openCreateModal() {
    setEditingPost(null);
    setIsCreating(true);
    setModalNotice(null);
    setPreviewMode(false);
    setForm({ ...EMPTY_FORM, slug: '', author: 'AchillesDev10' });
  }

  function openEditModal(post: BlogPost) {
    setEditingPost(post);
    setIsCreating(false);
    setModalNotice(null);
    setPreviewMode(false);
    setForm({
      title: post.title,
      slug: post.slug,
      author: post.author,
      status: post.status,
      published_at: toDatetimeLocal(post.published_at),
      excerpt: post.excerpt || '',
      cover_image: post.cover_image || '',
      tags: post.tags || '',
      content: post.content,
    });
  }

  function handleTitleChange(value: string) {
    // En création : le slug suit le titre tant qu'il n'a pas été modifié manuellement.
    setForm((f) => ({
      ...f,
      title: value,
      slug: isCreating && (!f.slug || f.slug === slugify(f.title)) ? slugify(value) : f.slug,
    }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingPost && !isCreating) return;
    try {
      const res = await fetch(
        isCreating ? '/api/admin/blog' : `/api/admin/blog/${editingPost!.id}`,
        {
          method: isCreating ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (res.status === 401) {
        closeModal();
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        throw new Error(
          data.error || (isCreating ? 'Erreur lors de la création' : 'Erreur lors de la modification')
        );
      }
      if (isCreating && data.post) {
        setPosts((prev) => [data.post, ...prev]);
      } else if (!isCreating && editingPost) {
        setPosts((prev) =>
          prev.map((p) => (p.id === editingPost.id ? { ...p, ...data.post } : p))
        );
      }
      closeModal();
      startTransition(() => {
        router.refresh();
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  async function handleQuickStatus(post: BlogPost, status: BlogPostStatus) {
    const previous = posts;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status } : p)));
    try {
      const res = await fetch(`/api/admin/blog/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) {
        setPosts(previous);
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setPosts(previous);
      alert(err instanceof Error && err.message ? err.message : 'Impossible de modifier le statut.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cet article ?')) return;
    const previous = posts;
    setPosts((prev) => prev.filter((p) => p.id !== id));
    try {
      const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        setPosts(previous);
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setPosts(previous);
      alert(err instanceof Error && err.message ? err.message : 'Impossible de supprimer l’article.');
    }
  }

  const inputClass =
    'w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors';
  const labelClass =
    'block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1';

  return (
    <div className="space-y-8 pb-24">
      {/* ===== En-tête ===== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
            Gestion du blog
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Rédigez, publiez et organisez les articles du blog public (
            <a href="/blog" target="_blank" rel="noreferrer" className="text-primary hover:underline">
              voir le blog ↗
            </a>
            ). Seuls les articles « Publiés » sont visibles sur le site.
          </p>
        </div>
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

      {/* ===== Onglets de statut ===== */}
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

      {/* ===== Recherche ===== */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
        <div className="w-full md:w-96 relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par titre, auteur, tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* ===== Tableau ===== */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6">Article</th>
                <th className="py-4 px-6">Tags</th>
                <th className="py-4 px-6">Statut</th>
                <th className="py-4 px-6">Publié le</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredPosts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-500">
                    Aucun article trouvé dans cette vue.
                  </td>
                </tr>
              ) : (
                filteredPosts.map((post) => {
                  const badge = STATUS_BADGES[post.status];
                  const tags = tagList(post.tags);
                  return (
                    <tr key={post.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="shrink-0 w-14 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-lg">
                            {post.cover_image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={post.cover_image}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <span aria-hidden="true">📄</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-white truncate max-w-xs">
                              {post.title}
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              /blog/{post.slug} · {post.author}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        {tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-[180px]">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="inline-flex rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300"
                              >
                                #{t}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${badge.className}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-xs text-slate-300 whitespace-nowrap">
                        {formatDate(post.status === 'published' ? post.published_at : post.updated_at)}
                      </td>
                      <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                        {post.status === 'published' && (
                          <a
                            href={`/blog/${post.slug}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
                          >
                            Voir
                          </a>
                        )}
                        {post.status !== 'published' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(post, 'published')}
                            className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20"
                          >
                            Publier
                          </button>
                        )}
                        {post.status === 'published' && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatus(post, 'draft')}
                            className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold border border-amber-500/20"
                          >
                            Dépublier
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openEditModal(post)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
                        >
                          Éditer
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(post.id)}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold"
                        >
                          Supprimer
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Modal d'édition / création ===== */}
      {(editingPost || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white font-[var(--font-display)]">
                  {isCreating ? 'Nouvel article' : "Modifier l'article"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Rédigez en Markdown simple (## titres, puces, **gras**) et choisissez le statut.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-slate-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              {/* Informations principales */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">
                  1. Informations
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Titre (obligatoire)</label>
                    <input
                      type="text"
                      required
                      value={form.title}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      className={inputClass}
                      placeholder="Ex : Comment réussir un entretien à Abidjan"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Slug (adresse URL)</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={form.slug}
                        onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                        className={inputClass}
                        placeholder="adresse-de-l-article"
                      />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, slug: slugify(form.title) })}
                        title="Générer depuis le titre"
                        className="shrink-0 rounded-2xl border border-slate-800 bg-slate-800 px-3 text-slate-200 hover:bg-slate-700 text-xs font-bold transition-colors"
                      >
                        Auto
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500 ml-1">
                      URL finale : /blog/{form.slug || '…'}
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Auteur</label>
                    <input
                      type="text"
                      value={form.author}
                      onChange={(e) => setForm({ ...form, author: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Statut</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as BlogPostStatus })}
                      className={inputClass}
                    >
                      <option value="draft">Brouillon</option>
                      <option value="published">Publié</option>
                      <option value="archived">Archivé</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Date de publication</label>
                    <input
                      type="datetime-local"
                      value={form.published_at}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          published_at: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : '',
                        })
                      }
                      className={inputClass}
                    />
                    <p className="mt-1 text-[10px] text-slate-500 ml-1">
                      Optionnel — « maintenant » si vide et statut « Publié ».
                    </p>
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Résumé (extrait, affiché dans les listes)</label>
                  <textarea
                    rows={2}
                    maxLength={200}
                    value={form.excerpt}
                    onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                    className={inputClass}
                    placeholder="Une phrase qui donne envie de lire l'article…"
                  />
                  <div className="text-right text-[10px] text-slate-500 mt-1">
                    {form.excerpt.length}/200 car.
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Image de couverture (URL)</label>
                    <input
                      type="url"
                      value={form.cover_image}
                      onChange={(e) => setForm({ ...form, cover_image: e.target.value })}
                      className={inputClass}
                      placeholder="https://…"
                    />
                    <p className="mt-1 text-[10px] text-slate-500 ml-1">
                      Optionnel — un visuel générique est affiché sinon.
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>Tags (séparés par des virgules)</label>
                    <input
                      type="text"
                      value={form.tags}
                      onChange={(e) => setForm({ ...form, tags: e.target.value })}
                      className={inputClass}
                      placeholder="emploi, cv, conseils"
                    />
                  </div>
                </div>

                {form.cover_image && (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={form.cover_image}
                      alt="Aperçu de la couverture"
                      className="w-full h-40 object-cover rounded-xl"
                    />
                  </div>
                )}
              </div>

              {/* Contenu */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-wider">
                    2. Contenu (Markdown)
                  </h4>
                  <div className="flex items-center gap-1 rounded-xl bg-slate-950 border border-slate-800 p-1">
                    <button
                      type="button"
                      onClick={() => setPreviewMode(false)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        !previewMode ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Écrire
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewMode(true)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors ${
                        previewMode ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Aperçu
                    </button>
                  </div>
                </div>

                {modalNotice && (
                  <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
                    {modalNotice}
                  </p>
                )}

                {previewMode ? (
                  <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 min-h-[240px] text-slate-300 text-sm">
                    {form.content.trim() ? (
                      <SimpleMarkdown text={form.content} />
                    ) : (
                      <p className="text-slate-500 text-center py-10">
                        Rien à prévisualiser pour le moment.
                      </p>
                    )}
                  </div>
                ) : (
                  <textarea
                    rows={14}
                    required
                    value={form.content}
                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                    className={`${inputClass} font-mono text-xs leading-relaxed`}
                    placeholder={'## Introduction\n\nVotre texte ici…\n\n- Point 1\n- Point 2\n\n**En gras** et *en italique*.'}
                  />
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl bg-slate-800 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-60"
                >
                  {isCreating ? 'Créer l’article' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

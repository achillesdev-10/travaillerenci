'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { EntreprendreComment, EntreprendreCommentStatus } from '@/types/entreprendre';

const STATUS_TABS: Array<{ value: EntreprendreCommentStatus | 'all'; label: string; activeClass: string }> = [
  { value: 'all', label: 'Tous', activeClass: 'bg-primary text-slate-950' },
  { value: 'visible', label: 'Visibles', activeClass: 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20' },
  { value: 'reported', label: 'Signalés', activeClass: 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' },
  { value: 'hidden', label: 'Masqués', activeClass: 'bg-slate-700 text-white' },
];

const STATUS_BADGES: Record<EntreprendreCommentStatus, { label: string; className: string; dot: string }> = {
  visible: { label: 'Visible', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  reported: { label: 'Signalé', className: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dot: 'bg-rose-400' },
  hidden: { label: 'Masqué', className: 'bg-slate-700/30 text-slate-400 border-slate-600/30', dot: 'bg-slate-400' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(d);
}

export default function CommentsAdminClient({
  initialComments,
}: {
  initialComments: EntreprendreComment[];
}) {
  const router = useRouter();
  const [comments, setComments] = useState<EntreprendreComment[]>(initialComments);
  const [statusFilter, setStatusFilter] = useState<EntreprendreCommentStatus | 'all'>('all');
  const [, startTransition] = useTransition();

  async function readError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error) return data.error;
    } catch { /* noop */ }
    return `Erreur serveur (${res.status}).`;
  }

  function redirectToLogin() {
    router.replace('/cz7tk/login?next=/cz7tk/entreprendre/comments');
  }

  const filteredComments = useMemo(() => {
    if (statusFilter === 'all') return comments;
    return comments.filter((c) => c.status === statusFilter);
  }, [comments, statusFilter]);

  const statusCount = (s: EntreprendreCommentStatus | 'all') =>
    s === 'all' ? comments.length : comments.filter((c) => c.status === s).length;

  async function handleStatusChange(comment: EntreprendreComment, newStatus: EntreprendreCommentStatus) {
    const previous = comments;
    setComments((prev) => prev.map((c) => (c.id === comment.id ? { ...c, status: newStatus } : c)));
    try {
      const res = await fetch(`/api/cz7tk/entreprendre/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.status === 401) { setComments(previous); redirectToLogin(); return; }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      setComments(previous);
      alert(err instanceof Error && err.message ? err.message : 'Impossible de modifier le statut.');
    }
  }

  async function handleDelete(comment: EntreprendreComment) {
    if (!confirm('Supprimer ce commentaire définitivement ?')) return;
    const previous = comments;
    setComments((prev) => prev.filter((c) => c.id !== comment.id));
    try {
      const res = await fetch(`/api/cz7tk/entreprendre/comments/${comment.id}`, { method: 'DELETE' });
      if (res.status === 401) { setComments(previous); redirectToLogin(); return; }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      setComments(previous);
      alert(err instanceof Error && err.message ? err.message : 'Impossible de supprimer le commentaire.');
    }
  }

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <a href="/cz7tk/entreprendre" className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5" /><path d="m12 19-7-7 7-7" />
            </svg>
          </a>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
            Modération des commentaires
          </h1>
        </div>
        <p className="text-sm text-slate-400">
          Gérez les commentaires de la section Entreprendre. Les commentaires signalés apparaissent en priorité.
        </p>
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

      {/* Comments list */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
        {filteredComments.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <p className="text-lg font-semibold mb-1">Aucun commentaire</p>
            <p className="text-xs">Aucun commentaire ne correspond à ce filtre.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800/60">
            {filteredComments.map((comment) => {
              const badge = STATUS_BADGES[comment.status];
              return (
                <div key={comment.id} className="p-5 hover:bg-slate-900/30 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(comment.user_display_name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white">{comment.user_display_name || 'Utilisateur'}</div>
                          <div className="text-[11px] text-slate-500">
                            {formatDate(comment.created_at)} · Article: {comment.article_id.slice(0, 8)}…
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${badge.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap ml-11">{comment.content}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {comment.status !== 'visible' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(comment, 'visible')}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20"
                          title="Rendre visible"
                        >✓ Approuver</button>
                      )}
                      {comment.status !== 'hidden' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(comment, 'hidden')}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 text-xs font-bold border border-amber-500/20"
                          title="Masquer ce commentaire"
                        >🙈 Masquer</button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(comment)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold"
                        title="Supprimer définitivement"
                      >🗑 Supprimer</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

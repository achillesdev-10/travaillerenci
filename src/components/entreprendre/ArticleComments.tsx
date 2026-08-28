'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import type { EntreprendreComment } from '@/types/entreprendre';
import { useAuth } from '@/hooks';

interface ArticleCommentsProps {
  articleId: string;
}

export default function ArticleComments({ articleId }: ArticleCommentsProps) {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const [comments, setComments] = useState<EntreprendreComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Charger les commentaires
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/entreprendre/${articleId}/comments`);
        if (!cancelled && res.ok) {
          const data = await res.json();
          setComments(data.comments || []);
          setTotal(data.total || 0);
        }
      } catch {
        // Silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [articleId]);

  // Soumettre un commentaire
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!content.trim() || submitting) return;
      setSubmitting(true);
      setError('');
      setSuccess('');

      try {
        const res = await fetch(`/api/entreprendre/${articleId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: content.trim() }),
        });

        if (res.ok) {
          setContent('');
          setSuccess('Votre commentaire a été publié !');
          // Recharger les commentaires
          const reload = await fetch(`/api/entreprendre/${articleId}/comments`);
          if (reload.ok) {
            const data = await reload.json();
            setComments(data.comments || []);
            setTotal(data.total || 0);
          }
          setTimeout(() => setSuccess(''), 3000);
        } else {
          const data = await res.json();
          setError(data.error || 'Erreur lors de la publication.');
        }
      } catch {
        setError('Erreur réseau. Réessayez.');
      } finally {
        setSubmitting(false);
      }
    },
    [articleId, content, submitting],
  );

  // Signaler un commentaire
  const handleReport = useCallback(
    async (commentId: string) => {
      try {
        await fetch(`/api/entreprendre/comments/${commentId}/report`, {
          method: 'POST',
        });
      } catch {
        // Silently ignore
      }
    },
    [],
  );

  function formatDate(iso: string) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  return (
    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-border p-6 sm:p-8">
      <h2 className="text-lg font-bold text-gray-900 dark:text-white font-[var(--font-display)] mb-5 flex items-center gap-2">
        <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
        Commentaires
        {total > 0 && (
          <span className="ml-1 text-sm font-semibold text-gray-400 dark:text-gray-500">
            ({total})
          </span>
        )}
      </h2>

      {/* Liste des commentaires */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse rounded-xl bg-gray-50 dark:bg-slate-800 p-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-slate-700" />
                <div className="h-3 w-24 rounded bg-gray-200 dark:bg-slate-700" />
              </div>
              <div className="h-3 w-full rounded bg-gray-200 dark:bg-slate-700" />
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
          Aucun commentaire pour le moment. Soyez le premier à réagir !
        </p>
      ) : (
        <div className="space-y-3 mb-6">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-border/50 p-4"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {(comment.user_display_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {comment.user_display_name || 'Utilisateur'}
                  </div>
                  <div className="text-[11px] text-gray-400 dark:text-gray-500">
                    {formatDate(comment.created_at)}
                  </div>
                </div>
                {user && user.id !== comment.user_id && (
                  <button
                    type="button"
                    onClick={() => handleReport(comment.id)}
                    className="ml-auto text-[11px] text-gray-400 hover:text-red-500 transition-colors"
                    title="Signaler ce commentaire"
                  >
                    🚩 Signaler
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Formulaire d'ajout */}
      {authLoading ? (
        <div className="h-24 rounded-xl bg-gray-50 dark:bg-slate-800 animate-pulse" />
      ) : isAuthenticated ? (
        <form onSubmit={handleSubmit} className="mt-4">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
            Ajouter un commentaire
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Partagez votre avis ou votre expérience…"
            rows={3}
            className="w-full rounded-xl border border-border bg-gray-50 dark:bg-slate-800 px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none transition-all"
          />
          {error && (
            <p className="mt-1 text-xs text-red-500">{error}</p>
          )}
          {success && (
            <p className="mt-1 text-xs text-emerald-600">{success}</p>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={!content.trim() || submitting}
              className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              {submitting ? 'Publication…' : 'Publier'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-4 rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-dashed border-border p-5 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Connectez-vous pour laisser un commentaire.
          </p>
          <div className="mt-3 flex items-center justify-center gap-3">
            <Link
              href={`/login?next=${encodeURIComponent(`/entreprendre`)}`}
              className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 rounded-xl border border-border text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
            >
              S&apos;inscrire
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

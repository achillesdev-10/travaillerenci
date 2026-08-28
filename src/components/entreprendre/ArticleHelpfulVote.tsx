'use client';

import { useState, useCallback } from 'react';

interface ArticleHelpfulVoteProps {
  articleId: string;
  initialCount: number;
}

export default function ArticleHelpfulVote({
  articleId,
  initialCount,
}: ArticleHelpfulVoteProps) {
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVote = useCallback(async () => {
    if (voted || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/entreprendre/${articleId}/helpful`, {
        method: 'POST',
      });
      if (res.ok) {
        setCount((c) => c + 1);
        setVoted(true);
      }
    } catch {
      // Silently ignore — vote is best-effort
    } finally {
      setLoading(false);
    }
  }, [articleId, voted, loading]);

  return (
    <div className="mt-8 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-border p-5 text-center">
      <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3">
        Cet article vous a-t-il été utile ?
      </p>
      <button
        type="button"
        onClick={handleVote}
        disabled={voted || loading}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
          voted
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 cursor-default'
            : 'bg-white dark:bg-slate-900 border border-border text-gray-700 dark:text-gray-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:border-emerald-300 dark:hover:border-emerald-700 active:scale-95'
        }`}
      >
        {voted ? (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 10v12" />
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
            Merci !
          </>
        ) : (
          <>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 10v12" />
              <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
            </svg>
            Oui, cet article m&apos;a aidé
          </>
        )}
      </button>
      {count > 0 && (
        <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
          {count} personne{count > 1 ? 's' : ''} ont trouvé cet article utile
        </p>
      )}
    </div>
  );
}

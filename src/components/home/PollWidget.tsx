'use client';

import { useCallback, useEffect, useState } from 'react';

interface PollData {
  question: string;
  options: string[];
  votes: number[];
}

const STORAGE_KEY = 'travaillerenci_poll_2026';

function uid(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function PollWidget() {
  const [poll, setPoll] = useState<PollData | null>(null);
  const [voted, setVoted] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/home/poll');
      if (res.ok) {
        const data = (await res.json()) as PollData;
        setPoll(data);
      }
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(STORAGE_KEY);
    } catch {
      stored = null;
    }
    if (stored !== null) {
      const idx = Number(stored);
      if (Number.isInteger(idx)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setVoted(idx);
        load();
        return;
      }
    }
    load();
  }, [load]);

  async function vote(option: number) {
    if (submitting !== null || voted !== null) return;
    setSubmitting(option);
    let visitor = '';
    try {
      visitor = localStorage.getItem('travaillerenci_visitor_id') || uid();
      localStorage.setItem('travaillerenci_visitor_id', visitor);
    } catch {
      visitor = uid();
    }
    try {
      const res = await fetch('/api/home/poll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option, visitor }),
      });
      if (res.ok) {
        const data = (await res.json()) as PollData;
        setPoll(data);
        setVoted(option);
        try {
          localStorage.setItem(STORAGE_KEY, String(option));
        } catch {
          /* noop */
        }
      }
    } catch {
      /* noop */
    } finally {
      setSubmitting(null);
    }
  }

  const total = poll ? poll.votes.reduce((a, b) => a + b, 0) : 0;

  return (
    <section
      aria-label="Sondage"
      className="rounded-2xl sm:rounded-3xl border border-orange-100 bg-white p-5 sm:p-6 shadow-sm dark:bg-slate-900 dark:border-slate-800"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/30">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
            <path d="M10 12.5 8.5 14a2 2 0 1 1-3-3L8 8.5a2 2 0 0 1 2.8 0l1.2 1.2" />
            <path d="M14 11.5l1.5-1.5a2 2 0 1 1 3 3l-2.5 2.5a2 2 0 0 1-2.8 0l-1.2-1.2" />
          </svg>
        </span>
        <div>
          <h2 className="font-[var(--font-display)] text-base font-extrabold text-gray-900 dark:text-white">
            Sondage
          </h2>
          <p className="text-[11px] uppercase tracking-widest text-gray-400">
            {total > 0 ? `${total} vote${total > 1 ? 's' : ''}` : 'Donnez votre avis'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-xl bg-gray-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : poll ? (
        <>
          <p className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            {poll.question}
          </p>

          <div className="space-y-2">
            {poll.options.map((option, i) => {
              const count = poll.votes[i] || 0;
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              const isVoted = voted === i;
              return (
                <div key={option}>
                  {voted === null ? (
                    <button
                      onClick={() => vote(i)}
                      disabled={submitting !== null}
                      className="group flex w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-left text-[13px] font-medium text-gray-700 transition-all hover:border-primary/40 hover:bg-primary/5 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800/60 dark:text-gray-200 dark:hover:bg-slate-800"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-gray-300 transition-colors group-hover:border-primary dark:border-slate-600">
                          {submitting === i && (
                            <svg className="h-3 w-3 animate-spin text-primary" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
                            </svg>
                          )}
                        </span>
                        {option}
                      </span>
                    </button>
                  ) : (
                    <div
                      className={`relative overflow-hidden rounded-xl border px-3.5 py-2.5 ${
                        isVoted
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-gray-100 bg-white dark:border-slate-700 dark:bg-slate-800/60'
                      }`}
                    >
                      <div
                        className="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
                          {option}
                          {isVoted && (
                            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">
                              Votre vote
                            </span>
                          )}
                        </span>
                        <span className="font-extrabold text-primary">{pct}%</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {voted === null && (
            <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
              Un seul vote par visiteur — les résultats s&apos;affichent immédiatement.
            </p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500">Le sondage est momentanément indisponible.</p>
      )}
    </section>
  );
}

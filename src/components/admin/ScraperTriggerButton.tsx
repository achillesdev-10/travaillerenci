'use client';

import { useState } from 'react';

export default function ScraperTriggerButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const triggerScraper = async () => {
    setStatus('loading');
    try {
      const res = await fetch('/api/admin/scraper/trigger', { method: 'POST' });
      if (res.ok) {
        setStatus('success');
        setTimeout(() => setStatus('idle'), 3000);
      } else {
        setStatus('error');
        setTimeout(() => setStatus('idle'), 3000);
      }
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  };

  return (
    <button
      onClick={triggerScraper}
      disabled={status === 'loading'}
      className={`w-full py-4 rounded-2xl text-sm font-bold transition-all shadow-lg ${
        status === 'loading'
          ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
          : status === 'success'
          ? 'bg-brand text-slate-950'
          : status === 'error'
          ? 'bg-rose-500 text-white'
          : 'bg-white text-slate-950 hover:bg-slate-200 active:scale-[0.98]'
      }`}
    >
      {status === 'loading' ? (
        <span className="flex items-center justify-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Lancement...
        </span>
      ) : status === 'success' ? (
        'Scraper lancé !'
      ) : status === 'error' ? (
        'Échec du lancement'
      ) : (
        'Déclencher le scraper'
      )}
    </button>
  );
}

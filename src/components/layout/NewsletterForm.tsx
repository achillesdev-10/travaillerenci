'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

/**
 *  Formulaire d'inscription à la newsletter (pied de page, §20).
 *  Enregistrement seul : aucun service d'envoi n'est branché à ce stade.
 *  Le consentement est explicite et sa mention est envoyée au serveur.
 */
export default function NewsletterForm({ className = '' }: { className?: string }) {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setMessage(null);
    try {
      const res = await fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          consent,
          source: 'footer',
          page: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus('error');
        setMessage(data?.error || 'Une erreur est survenue. Réessayez.');
        return;
      }
      setStatus('success');
      setEmail('');
      setConsent(false);
      setMessage('Merci ! Votre inscription est enregistrée.');
    } catch {
      setStatus('error');
      setMessage('Serveur injoignable. Réessayez.');
    }
  }

  return (
    <form onSubmit={handleSubmit} className={cn('w-full max-w-md', className)} noValidate>
      <label
        htmlFor="newsletter-email"
        className="block text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2"
      >
        Newsletter
      </label>
      <div className="flex gap-2">
        <input
          id="newsletter-email"
          type="email"
          name="email"
          autoComplete="email"
          required
          placeholder="votre@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="Votre adresse email"
          className="min-w-0 flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={status === 'loading'}
          className="shrink-0 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-white hover:brightness-110 disabled:opacity-50 transition-all"
        >
          {status === 'loading' ? '…' : 'Je m’inscris'}
        </button>
      </div>

      <label className="mt-2.5 flex items-start gap-2 text-[11px] leading-relaxed text-gray-500 cursor-pointer">
        <input
          type="checkbox"
          required
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
        />
        <span>
          J’accepte de recevoir la newsletter TravaillerEnCi (offres, concours, bourses).
          Désinscription en un clic.
        </span>
      </label>

      {message ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            'mt-2 text-[11px] font-semibold',
            status === 'success' ? 'text-emerald-400' : 'text-rose-400',
          )}
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}

'use client';

import { useState } from 'react';
import { apiVerifyEmail } from '@/lib/authApi';

/** Bandeau « email non vérifié » — permet de renvoyer le lien de confirmation. */
export default function VerifyEmailBanner({ email }: { email: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  async function resend() {
    setState('sending');
    const result = await apiVerifyEmail({ email });
    setState(result.ok ? 'sent' : 'error');
  }

  return (
    <div className="rounded-3xl border border-amber-500/40 bg-amber-50 dark:bg-slate-900 dark:border-amber-500/30 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1 flex items-start gap-3">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4Z" />
          </svg>
        </div>
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-sm">Confirmez votre adresse email</p>
          <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5 leading-relaxed">
            Un email de confirmation a été envoyé à <strong>{email}</strong>. Confirmez-le
            pour activer vos alertes et recevoir les notifications de vos offres sauvegardées.
          </p>
        </div>
      </div>
      <div className="shrink-0">
        {state === 'sent' ? (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-4 py-2.5 text-xs font-bold">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 12l2 2 4-4" />
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            </svg>
            Email envoyé
          </span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={state === 'sending'}
            className="rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2.5 text-xs font-bold transition-all"
          >
            {state === 'sending' ? 'Envoi…' : 'Renvoyer le lien'}
          </button>
        )}
      </div>
    </div>
  );
}

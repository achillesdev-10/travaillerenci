'use client';

import { useEffect, useState } from 'react';
import { fetchCurrentUser } from '@/lib/clientAuth';
import { apiResendVerification } from '@/lib/authApi';

/**
 * Bannière « Email non vérifié » — affichée tant que l'email du compte n'a pas
 * été confirmé (vérification d'email ACTIVÉE via EMAIL_VERIFICATION_ENABLED).
 *
 * Inclut un bouton « Renvoyer le lien » (POST /api/auth/resend-verification,
 * cooldown 1 minute côté serveur) avec retour visuel clair.
 *
 * Utilisation :
 *   • <EmailVerificationBanner emailVerified={user?.email_verified} /> — quand
 *     la page connaît déjà l'utilisateur (pas de double fetch) ;
 *   • <EmailVerificationBanner /> — le composant récupère lui-même la session.
 */
export default function EmailVerificationBanner({
  emailVerified,
}: {
  /** État connu par la page parente ; absent → auto-récupération. */
  emailVerified?: boolean;
}) {
  // Prop prioritaire quand la page connaît déjà l'utilisateur ; sinon état
  // récupéré ici-même (une seule source, pas de setState synchronisé en effet).
  const [selfVerified, setSelfVerified] = useState<boolean | null>(null);
  const verified = emailVerified !== undefined ? emailVerified : selfVerified;
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (emailVerified !== undefined) return; // la page fournit déjà l'état
    let cancelled = false;
    fetchCurrentUser().then((user) => {
      if (!cancelled) setSelfVerified(user ? user.email_verified ?? true : true);
    });
    return () => {
      cancelled = true;
    };
  }, [emailVerified]);

  // Rien à signaler : utilisateur inconnu, email vérifié ou encore en chargement.
  if (verified !== false) return null;

  async function handleResend() {
    if (status === 'sending') return;
    setStatus('sending');
    setFeedback(null);
    const result = await apiResendVerification();
    if (result.ok) {
      setStatus('sent');
      setFeedback(result.data.message || 'Lien renvoyé. Vérifiez votre boîte mail.');
    } else {
      setStatus('error');
      setFeedback(result.error);
    }
  }

  return (
    <div className="rounded-3xl border border-amber-500/40 bg-amber-50 dark:bg-slate-900 dark:border-amber-500/30 p-5 lg:p-6 shadow-xl flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 border border-amber-500/30 mb-3">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Email non confirmé
        </span>
        <h2 className="text-base font-bold font-[var(--font-display)] mb-1">
          Confirmez votre adresse email
        </h2>
        <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
          Cliquez sur le lien reçu par email pour activer toutes les fonctionnalités
          (alertes, sauvegarde d'offres…). Le lien est valable 24 heures.
        </p>
        {feedback ? (
          <p
            className={`mt-2 text-xs font-semibold ${
              status === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {feedback}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={handleResend}
        disabled={status === 'sending'}
        className="shrink-0 rounded-xl border border-amber-500/40 bg-white dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? 'Envoi…' : status === 'sent' ? 'Lien renvoyé ✓' : 'Renvoyer le lien'}
      </button>
    </div>
  );
}

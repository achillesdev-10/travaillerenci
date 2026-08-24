'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiMigrateLegacy } from '@/lib/authApi';
import { clearLegacyAuthKeys, fetchCurrentUser, readLegacyAccount } from '@/lib/clientAuth';

/**
 *  TravaillerEnCi — LegacyAccountMigrator
 *  Détecte un ancien compte « simulé » (localStorage, sans mot de passe réel)
 *  et le migre vers la table users via /api/auth/migrate-legacy.
 *
 *  • Une seule fois par navigateur : les clés localStorage sont supprimées
 *    après traitement (succès ou compte existant).
 *  • Après migration, l'utilisateur est auto-connecté et invité à définir un
 *    vrai mot de passe (drapeau needs_password_reset) sur son dashboard.
 *  • Si l'email existe déjà en base (vrai compte), on ne l'écrase jamais :
 *    on supprime simplement la clé locale obsolète.
 */
export default function LegacyAccountMigrator() {
  const router = useRouter();
  const [status, setStatus] = useState<'idle' | 'checking' | 'migrated' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // StrictMode (dev) monte l'effet 2 fois : le drapeau `cancelled` du premier
    // run annule sa requête, le second run fait le travail — aucun garde
    // supplémentaire n'est nécessaire (et en ajouter un bloquerait la
    // migration en dev).
    const legacy = readLegacyAccount();
    if (!legacy) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('done');
      return;
    }

    let cancelled = false;
    setStatus('checking');

    // Sécurité : si un vrai compte est déjà connecté, on ne migre pas (on ne
    // veut pas écraser sa session par le compte migré) — on nettoie seulement
    // les clés locales obsolètes.
    const migrate = async () => {
      const current = await fetchCurrentUser();
      if (cancelled) return;
      if (current) {
        clearLegacyAuthKeys();
        setStatus('done');
        return;
      }

      const result = await apiMigrateLegacy({
        email: legacy.email,
        name: legacy.name,
        role: legacy.role,
      });
      if (cancelled) return;
      clearLegacyAuthKeys();
      if (result.ok && result.data.migrated) {
        setStatus('migrated');
      } else {
        // Compte existant (vrai compte) ou autre : rien à migrer.
        setStatus('done');
      }
    };

    migrate().catch(() => {
      if (cancelled) return;
      setStatus('error');
      setError('Impossible de migrer votre ancien compte pour le moment.');
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'idle' || status === 'checking' || status === 'done') return null;
  if (status === 'error') {
    return (
      <div className="fixed bottom-4 inset-x-4 z-[60] max-w-xl mx-auto rounded-2xl border border-rose-500/30 bg-white dark:bg-slate-900 shadow-2xl p-4 text-sm text-rose-600 dark:text-rose-300">
        <div className="flex items-center gap-3">
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setStatus('done')}
            className="shrink-0 text-xs font-bold hover:underline"
          >
            Fermer
          </button>
        </div>
      </div>
    );
  }

  // migrated
  return (
    <div className="fixed bottom-4 inset-x-4 z-[60] max-w-xl mx-auto rounded-2xl border border-emerald-500/30 bg-white dark:bg-slate-900 shadow-2xl p-4">
      <div className="flex items-center gap-3 text-sm">
        <span className="w-9 h-9 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <svg className="w-4.5 h-4.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <div className="flex-1">
          <div className="font-bold text-gray-900 dark:text-white">Votre compte a été migré</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            Définissez un mot de passe pour sécuriser vos accès.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              router.push('/dashboard/candidate');
            }}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white hover:brightness-110 transition-all"
          >
            Définir mon mot de passe
          </button>
          <button
            type="button"
            onClick={() => setStatus('done')}
            aria-label="Fermer"
            className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

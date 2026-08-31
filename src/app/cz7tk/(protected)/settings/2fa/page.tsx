'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { buildOtpauthUrl, is2faEnabled, generateSecret } from '@/lib/totp';

export default function TwoFactorSetupPage() {
  const router = useRouter();
  const [secret, setSecret] = useState('');
  const [otpauthUrl, setOtpauthUrl] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const existing = is2faEnabled();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(existing);

    if (!existing) {
      const newSecret = generateSecret();
      setSecret(newSecret);
      setOtpauthUrl(buildOtpauthUrl(newSecret, 'admin@travaillerenci.ci'));
    }
  }, []);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/admin/2fa/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, code: verifyCode }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Code invalide');
      }

      setIsVerified(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      setError(msg);
    }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // --- État : 2FA déjà activée ---
  if (enabled && !isVerified) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Authentification à deux facteurs
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            La 2FA est déjà activée pour votre compte administrateur.
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-center gap-3 text-emerald-400 font-medium">
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            2FA activée
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Votre compte est protégé par une seconde couche
            d&apos;authentification.
          </p>
        </div>

        <button
          onClick={() => router.push('/cz7tk/settings')}
          className="rounded-2xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-all"
        >
          Retour aux paramètres
        </button>
      </div>
    );
  }

  // --- État : 2FA configurée avec succès ---
  if (isVerified) {
    return (
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">
            2FA configurée avec succès
          </h1>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 space-y-4">
          <div className="flex items-center gap-3 text-emerald-400 font-medium">
            <svg
              className="w-5 h-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            Configuration terminée
          </div>
          <p className="text-slate-400 text-sm">
            L&apos;authentification à deux facteurs est maintenant active.
            Lors de votre prochaine connexion, un code TOTP vous sera demandé
            après le mot de passe.
          </p>
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-4">
            <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider mb-2">
              ⚠️ Important — Sauvegardez votre secret
            </p>
            <p className="text-xs text-slate-400 mb-3">
              Ajoutez cette variable dans votre fichier{' '}
              <code className="text-slate-300">.env.local</code> ou les
              variables d&apos;environnement Vercel :
            </p>
            <code className="block text-xs text-emerald-400 bg-slate-900 rounded-lg p-3 break-all font-mono">
              ADMIN_TOTP_SECRET={secret}
            </code>
          </div>
        </div>

        <button
          onClick={() => router.push('/cz7tk/settings')}
          className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-slate-950 hover:brightness-110 transition-all"
        >
          Retour aux paramètres
        </button>
      </div>
    );
  }

  // --- État par défaut : configuration de la 2FA ---
  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Configurer l&apos;authentification à deux facteurs
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          Ajoutez une couche de sécurité supplémentaire à votre compte
          administrateur.
        </p>
      </div>

      {/* Étape 1 : Scanner le QR code */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
            1
          </span>
          <h2 className="text-lg font-semibold text-white">
            Scanner le QR code
          </h2>
        </div>
        <p className="text-sm text-slate-400">
          Ouvrez Google Authenticator, Authy ou une autre application TOTP et
          scannez ce QR code :
        </p>

        <div className="flex justify-center py-4">
          <div className="bg-white p-4 rounded-2xl">
            <Image
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpauthUrl)}`}
              alt="QR Code 2FA"
              width={200}
              height={200}
              unoptimized
              className="rounded-lg"
            />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-slate-500">
            Pas de caméra ? Saisissez manuellement cette clé secrète :
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 font-mono break-all">
              {secret}
            </code>
            <button
              onClick={copySecret}
              className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:bg-slate-800 transition-all"
            >
              {copied ? '✓' : 'Copier'}
            </button>
          </div>
        </div>
      </div>

      {/* Étape 2 : Vérifier le code */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold">
            2
          </span>
          <h2 className="text-lg font-semibold text-white">
            Vérifier le code
          </h2>
        </div>
        <p className="text-sm text-slate-400">
          Saisissez le code à 6 chiffres affiché dans votre application pour
          valider la configuration :
        </p>

        {error && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-medium text-rose-400 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleVerify} className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Code de vérification
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              value={verifyCode}
              onChange={(e) =>
                setVerifyCode(e.target.value.replace(/\D/g, ''))
              }
              placeholder="000000"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-colors text-center tracking-[0.5em] font-mono"
            />
          </div>
          <button
            type="submit"
            disabled={verifyCode.length !== 6}
            className="rounded-2xl bg-primary px-6 py-3 text-sm font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            Activer
          </button>
        </form>
      </div>

      <button
        onClick={() => router.push('/cz7tk/settings')}
        className="rounded-2xl border border-slate-700 px-6 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-all"
      >
        Annuler
      </button>
    </div>
  );
}

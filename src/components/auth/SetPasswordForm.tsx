'use client';

import { useState } from 'react';
import { apiSetPassword } from '@/lib/authApi';
import PasswordInput from '@/components/auth/PasswordInput';

/**
 *  TravaillerEnCi — SetPasswordForm
 *  Permet à un utilisateur connecté (compte migré / Google) de définir son
 *  mot de passe. Appelle /api/auth/set-password, qui exige une session valide.
 */
interface SetPasswordFormProps {
  /** Appelé après une définition réussie (pour masquer la carte parente). */
  onSuccess?: () => void;
}

export default function SetPasswordForm({ onSuccess }: SetPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.');
      return;
    }

    setLoading(true);
    const result = await apiSetPassword({ password });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(result.data.message || 'Mot de passe défini.');
    setPassword('');
    setConfirm('');
    // Laisse le temps de voir la confirmation avant de masquer la carte parente.
    window.setTimeout(() => onSuccess?.(), 1200);
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-sm text-emerald-700 dark:text-emerald-300 flex items-start gap-3">
        <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        <div>
          <div className="font-bold">Mot de passe enregistré</div>
          <p className="text-xs mt-1">
            {success} Vous pouvez désormais vous connecter avec votre email et mot de passe.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <div
          role="alert"
          className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <PasswordInput
        label="Nouveau mot de passe"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
      />
      <PasswordInput
        label="Confirmer le mot de passe"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-2xl bg-primary py-3.5 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
      >
        {loading ? 'Enregistrement...' : 'Définir mon mot de passe'}
      </button>
    </form>
  );
}

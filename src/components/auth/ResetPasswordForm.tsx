'use client';

import { useState } from 'react';
import Link from 'next/link';
import PasswordInput from '@/components/auth/PasswordInput';
import { apiResetPassword } from '@/lib/authApi';

export default function ResetPasswordForm({ token }: { token: string }) {
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
    const result = await apiResetPassword({ token, password });
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuccess(result.data.message || 'Votre mot de passe a été réinitialisé.');
    setPassword('');
    setConfirm('');
  }

  if (success) {
    return (
      <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)]">
          Mot de passe réinitialisé
        </h1>
        <p className="text-sm text-gray-600 dark:text-slate-400">{success}</p>
        <Link
          href="/login"
          className="inline-block w-full rounded-2xl bg-primary py-3.5 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-primary/20"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl space-y-6">
      <div className="text-center space-y-2">
        <Link href="/" className="inline-block text-2xl font-black text-primary font-[var(--font-display)]">
          Travailleren<span className="text-gray-900 dark:text-white">Ci</span>
        </Link>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">
          Choisir un nouveau mot de passe
        </h1>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Saisissez votre nouveau mot de passe (6 caractères minimum).
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-600 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
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
          className="w-full rounded-2xl bg-primary py-3.5 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-primary/20 mt-2 disabled:opacity-50"
        >
          {loading ? 'Réinitialisation...' : 'Réinitialiser mon mot de passe'}
        </button>
      </form>

      <div className="text-center text-xs text-gray-500 dark:text-slate-400">
        Vous vous souvenez de votre mot de passe ?{' '}
        <Link href="/login" className="text-primary font-bold hover:underline">
          Se connecter
        </Link>
      </div>
    </div>
  );
}

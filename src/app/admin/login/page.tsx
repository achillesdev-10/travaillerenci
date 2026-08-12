'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PasswordInput from '@/components/auth/PasswordInput';

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get('next') || '/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Identifiants invalides');
      }

      router.replace(nextUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue';
      setError(msg);
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-black/30 text-white font-[var(--font-display)] text-2xl font-black mb-2">
            T
          </div>
          <h1 className="text-2xl font-extrabold text-white font-[var(--font-display)]">
            Administration TravaillerenCi
          </h1>
          <p className="text-xs text-slate-400">
            Veuillez vous authentifier avec vos identifiants administrateur.
          </p>
        </div>

        {error && (
          <div className="rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs font-medium text-rose-400 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Email administrateur
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="achillesdev10@gmail.com"
              className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <PasswordInput
            label="Mot de passe"
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
            labelClassName="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5 ml-0"
            inputClassName="rounded-2xl border border-slate-800 bg-slate-950 text-white placeholder-slate-600 focus:border-primary"
            buttonClassName="text-slate-500 hover:text-slate-200"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            {isLoading ? 'Connexion en cours...' : 'Se connecter au Dashboard'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <AdminLoginForm />
    </Suspense>
  );
}

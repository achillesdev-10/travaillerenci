import type { Metadata } from 'next';
import Link from 'next/link';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = {
  title: 'Réinitialiser votre mot de passe | TravaillerEnCi',
  description: 'Choisissez un nouveau mot de passe pour votre compte TravaillerEnCi.',
  robots: { index: false, follow: false },
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const sp = await searchParams;
  const token = sp.token?.trim() || '';

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center px-4 py-12 text-black dark:text-slate-50 transition-colors">
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="w-full max-w-md rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl text-center space-y-5">
          <div className="mx-auto w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center">
            <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-black dark:text-white font-[var(--font-display)]">
            Lien de réinitialisation manquant
          </h1>
          <p className="text-sm text-black dark:text-white">
            Ce lien est invalide ou incomplet. Utilisez le lien reçu par email, ou demandez un
            nouveau lien de réinitialisation.
          </p>
          <Link
            href="/login"
            className="inline-block w-full rounded-2xl bg-primary py-3.5 text-xs font-bold text-white hover:brightness-110 transition-all shadow-lg shadow-primary/20"
          >
            Retour à la connexion
          </Link>
        </div>
      )}
    </main>
  );
}

import Link from 'next/link';
import { is2faEnabled } from '@/lib/totp';

export const dynamic = 'force-dynamic';

export default function AdminSettingsPage() {
  const twoFactorEnabled = is2faEnabled();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
          Paramètres de la plateforme
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Gérez les configurations générales, les clés d'accès et les préférences administrateur.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 lg:p-8 shadow-xl space-y-6">
        <div>
          <h2 className="text-base font-bold text-white">Sécurité et authentification</h2>
          <p className="text-xs text-slate-400 mt-0.5">Paramètres de session administrateur</p>
        </div>

        <div className="space-y-4 max-w-xl">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Email Administrateur Principal
            </label>
            <input
              type="email"
              disabled
              value={process.env.ADMIN_EMAIL || 'achillesdev10@gmail.com'}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Défini via la variable d'environnement <code className="text-primary font-mono">ADMIN_EMAIL</code>.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Durée de session (TTL)
            </label>
            <input
              type="text"
              disabled
              value={`${process.env.ADMIN_SESSION_TTL_HOURS || 12} heures`}
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-400 cursor-not-allowed"
            />
          </div>

          {/* 2FA */}
          <div className="pt-4 border-t border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Authentification à deux facteurs (2FA)
                </label>
                <p className="text-[11px] text-slate-500">
                  {twoFactorEnabled
                    ? '✅ Activée — une seconde couche est requise lors de la connexion.'
                    : 'Non configurée — protégez votre compte avec Google Authenticator ou Authy.'}
                </p>
              </div>
              <Link
                href="/cz7tk/settings/2fa"
                className="shrink-0 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-all"
              >
                {twoFactorEnabled ? 'Gérer' : 'Activer'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

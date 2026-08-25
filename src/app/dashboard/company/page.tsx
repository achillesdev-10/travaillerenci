import Link from 'next/link';
import EmailVerificationBanner from '@/components/dashboard/EmailVerificationBanner';

export const dynamic = "force-dynamic";

export default function CompanyDashboardPage() {
  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8 text-gray-900 dark:text-slate-50 transition-colors">
      {/* Email non confirmé (vérification ACTIVÉE) → bannière + renvoi du lien */}
      <EmailVerificationBanner />
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 mb-2">
            Espace Recruteur / Entreprise
          </span>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white font-[var(--font-display)]">
            Tableau de Bord Recruteur
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
            Publiez vos offres d'emploi, gérez les candidatures reçues et trouvez vos futurs talents en Côte d'Ivoire.
          </p>
        </div>

        <Link
          href="/dashboard/company/jobs/new"
          className="rounded-2xl bg-primary text-white px-5 py-3 text-xs font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20 text-center"
        >
          + Publier une offre
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <Link
          href="/dashboard/company/jobs"
          className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-xl hover:border-primary/30 hover:shadow-md transition-all"
        >
          <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400">Mes offres</div>
          <div className="text-3xl font-black text-primary dark:text-emerald-400 mt-2">→</div>
          <div className="text-xs text-primary dark:text-emerald-400 mt-1 font-semibold">Gérer mes offres</div>
        </Link>

        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-xl">
          <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400">Candidatures reçues</div>
          <div className="text-3xl font-black text-gray-900 dark:text-white mt-2">—</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">Bientôt disponible</div>
        </div>

        <Link
          href="/dashboard/company/jobs/new"
          className="rounded-3xl border border-primary/30 dark:border-primary/20 bg-primary/5 dark:bg-primary/10 p-6 shadow-xl hover:shadow-md transition-all"
        >
          <div className="text-xs uppercase tracking-wider font-semibold text-primary dark:text-emerald-400">Nouvelle offre</div>
          <div className="text-3xl font-black text-primary dark:text-emerald-400 mt-2">+</div>
          <div className="text-xs text-primary dark:text-emerald-400 mt-1 font-semibold">Publier maintenant</div>
        </Link>
      </div>

      <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 lg:p-8 shadow-xl">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Dernières candidatures reçues</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          La gestion des candidatures sera bientôt disponible. Vous pourrez consulter, filtrer et contacter les candidats directement depuis cet espace.
        </p>
      </div>
    </div>
  );
}

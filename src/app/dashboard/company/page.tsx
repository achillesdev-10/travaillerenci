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

        <a
          href="/admin/jobs"
          className="rounded-2xl bg-primary text-white px-5 py-3 text-xs font-bold hover:brightness-110 transition-all shadow-lg shadow-primary/20 text-center"
        >
          + Publier une offre
        </a>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-xl">
          <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400">Offres publiées</div>
          <div className="text-3xl font-black text-gray-900 dark:text-white mt-2">2</div>
          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Actives et visibles</div>
        </div>

        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-xl">
          <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400">Candidatures reçues</div>
          <div className="text-3xl font-black text-gray-900 dark:text-white mt-2">14</div>
          <div className="text-xs text-primary mt-1">+5 cette semaine</div>
        </div>

        <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-xl">
          <div className="text-xs uppercase tracking-wider font-semibold text-gray-500 dark:text-slate-400">Vues totales des offres</div>
          <div className="text-3xl font-black text-gray-900 dark:text-white mt-2">380</div>
          <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">Engagement élevé</div>
        </div>
      </div>

      <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 lg:p-8 shadow-xl space-y-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dernières candidatures reçues</h2>
        <div className="divide-y divide-gray-100 dark:divide-slate-800 text-sm">
          <div className="py-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 dark:text-white">Koffi Kouadio — Développeur React / Node</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Pour le poste : Développeur Full Stack Senior</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                CV Téléchargé
              </span>
              <button type="button" className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-700">Contacter</button>
            </div>
          </div>

          <div className="py-4 flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 dark:text-white">Aya Marie Traoré — Master Marketing Digital</div>
              <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Pour le poste : Chef de Projet Marketing Digital</div>
            </div>
            <div className="flex items-center gap-3">
              <span className="inline-flex rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Nouveau
              </span>
              <button type="button" className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-white text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-700">Contacter</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

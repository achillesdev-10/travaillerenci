import Link from 'next/link';

export const metadata = {
  title: 'Politique de cookies — TravaillerenCi',
  description: 'Politique de cookies du site TravaillerenCi.',
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <section className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all mb-8">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h14" />
            <path d="m10 5-7 7 7 7" />
          </svg>
          Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white font-[var(--font-display)] mb-6">
          Politique de cookies
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Dernière mise à jour : 26 août 2026</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Qu&apos;est-ce qu&apos;un cookie ?</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Un cookie est un petit fichier texte déposé sur votre appareil (ordinateur, smartphone, tablette) lors de la consultation d&apos;un site web. Il permet au site de mémoriser vos actions et préférences pendant une durée déterminée.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cookies utilisés sur TravaillerenCi</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <thead className="bg-gray-100 dark:bg-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Cookie</th>
                    <th className="px-4 py-3 text-left font-semibold">Finalité</th>
                    <th className="px-4 py-3 text-left font-semibold">Durée</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                  <tr>
                    <td className="px-4 py-3 font-medium">session</td>
                    <td className="px-4 py-3">Authentification de la session utilisateur</td>
                    <td className="px-4 py-3">Session</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">travaillerenci_visitor_id</td>
                    <td className="px-4 py-3">Identifiant anonyme pour le sondage</td>
                    <td className="px-4 py-3">1 an</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">travaillerenci_poll_2026</td>
                    <td className="px-4 py-3">Mémoriser le vote du sondage</td>
                    <td className="px-4 py-3">1 an</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">travaillerenci_cv_data</td>
                    <td className="px-4 py-3">Sauvegarde locale du CV en cours d&apos;édition</td>
                    <td className="px-4 py-3">Illimitée</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">theme</td>
                    <td className="px-4 py-3">Préférence de thème (clair/sombre)</td>
                    <td className="px-4 py-3">Illimitée</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cookies tiers</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Nous n&apos;utilisons pas de cookies publicitaires ni de cookies de suivi tiers. Aucun cookie n&apos;est partagé avec des partenaires publicitaires.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Gestion des cookies</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Vous pouvez gérer les cookies directement depuis les paramètres de votre navigateur. La désactivation de certains cookies peut affecter le fonctionnement du site (authentification, sauvegarde du CV).
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Conditions d\'utilisation — TravaillerenCi',
  description: 'Conditions générales d\'utilisation du site TravaillerenCi.',
};

export default function ConditionsUtilisationPage() {
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
          Conditions d&apos;utilisation
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Dernière mise à jour : 26 août 2026</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Acceptation des conditions</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              En accédant et en utilisant le site TravaillerenCi (travaillerenci.ci), vous acceptez les présentes conditions d&apos;utilisation. Si vous n&apos;acceptez pas ces conditions, veuillez ne pas utiliser le site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">2. Description du service</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              TravaillerenCi est une plateforme d&apos;information mettant en relation les chercheurs d&apos;emploi, les étudiants et les recruteurs en Côte d&apos;Ivoire. Le site propose :
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 mt-2">
              <li>Des offres d&apos;emploi, de stages et de bourses d&apos;études</li>
              <li>Des informations sur les concours administratifs</li>
              <li>Un générateur de CV par intelligence artificielle</li>
              <li>Un blog avec des conseils et articles sur l&apos;emploi</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Compte utilisateur</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              La création d&apos;un compte est facultative. Si vous créez un compte, vous vous engagez à fournir des informations exactes et à maintenir la confidentialité de vos identifiants. Vous êtes responsable de toutes les activités effectuées depuis votre compte.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">4. Publication d&apos;offres</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Les recruteurs peuvent publier des offres via l&apos;espace dédié. Toutes les offres sont soumises à modération avant publication. TravaillerenCi se réserve le droit de refuser ou supprimer toute offre ne respectant pas la réglementation en vigueur ou les standards de qualité du site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">5. Propriété intellectuelle</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Le contenu généré par l&apos;IA (CV, lettres de motivation) reste la propriété de l&apos;utilisateur. TravaillerenCi ne revendique aucun droit sur les documents produits par ses outils d&apos;intelligence artificielle.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">6. Limitation de responsabilité</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              TravaillerenCi s&apos;efforce de fournir des informations fiables mais ne garantit pas l&apos;exactitude, l&apos;exhaustivité ou l&apos;actualité des contenus publiés. Le site ne saurait être tenu responsable des décisions prises sur la base des informations diffusées.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">7. Contact</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Pour toute question concernant ces conditions, contactez-nous à <a href="mailto:contact@travaillerenci.ci" className="text-primary hover:underline">contact@travaillerenci.ci</a>.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

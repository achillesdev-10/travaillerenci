import Link from 'next/link';

export const metadata = {
  title: 'Politique de confidentialité — TravaillerenCi',
  description: 'Politique de confidentialité et protection des données personnelles sur TravaillerenCi.',
};

export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <section className="container mx-auto px-4 py-12 md:py-20 max-w-3xl bg-gradient-to-br from-white via-gray-50 to-orange-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-orange-950/10 rounded-3xl mx-auto my-8">
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2.5 transition-all mb-8">
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h14" />
            <path d="m10 5-7 7 7 7" />
          </svg>
          Retour à l&apos;accueil
        </Link>

        <h1 className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white font-[var(--font-display)] mb-6">
          Politique de confidentialité
        </h1>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Dernière mise à jour : 26 août 2026</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">1. Données collectées</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Nous collectons les informations que vous nous fournissez directement :
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 mt-2">
              <li>Adresse email lors de la création de compte</li>
              <li>Informations de profil (nom, prénom, téléphone, photo)</li>
              <li>Données de CV que vous saisissez dans le générateur</li>
              <li>Alertes d&apos;emploi et préférences de recherche</li>
              <li>Votes au sondage (identifiant anonyme)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">2. Utilisation des données</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Vos données sont utilisées pour :
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 mt-2">
              <li>Vous permettre d&apos;accéder à votre espace personnel</li>
              <li>Personnaliser votre expérience (alertes, recommandations)</li>
              <li>Améliorer nos services et la qualité du site</li>
              <li>Vous envoyer des notifications relatives à vos candidatures</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">3. Partage des données</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Vos données personnelles ne sont ni vendues, ni partagées avec des tiers, sauf dans les cas suivants :
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 mt-2">
              <li>Avec votre consentement explicite</li>
              <li>Pour répondre à une obligation légale</li>
              <li>Avec nos prestataires techniques (hébergement, stockage) sous contrat de confidentialité</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">4. Sécurité</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre l&apos;accès non autorisé, la perte ou l&apos;altération. Vos mots de passe sont hashés et jamais stockés en clair.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">5. Vos droits</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Conformément à la loi ivoirienne n°2013-450, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 space-y-1 mt-2">
              <li><strong>Droit d&apos;accès</strong> : obtenir une copie de vos données</li>
              <li><strong>Droit de rectification</strong> : corriger des données inexactes</li>
              <li><strong>Droit de suppression</strong> : demander la suppression de votre compte et vos données</li>
              <li><strong>Droit d&apos;opposition</strong> : vous opposer au traitement de vos données</li>
            </ul>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed mt-2">
              Pour exercer ces droits, contactez-nous à <a href="mailto:achillesdev10@gmail.com" className="text-primary hover:underline">achillesdev10@gmail.com</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">6. Conservation des données</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Vos données sont conservées tant que votre compte est actif. Après suppression de votre compte, vos données personnelles sont supprimées dans un délai de 30 jours, sauf obligation légale de conservation.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

import Link from 'next/link';

export const metadata = {
  title: 'Mentions légales — TravaillerenCi',
  description: 'Mentions légales du site TravaillerenCi, plateforme d\'emploi en Côte d\'Ivoire.',
};

export default function MentionsLegalesPage() {
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
          Mentions légales
        </h1>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Éditeur du site</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              <strong>TravaillerenCi</strong><br />
              Site d&apos;information sur l&apos;emploi, les stages, les bourses et les concours administratifs en Côte d&apos;Ivoire.
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Email de contact : <a href="mailto:contact@travaillerenci.ci" className="text-primary hover:underline">contact@travaillerenci.ci</a>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Hébergeur</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Le site est hébergé par Vercel Inc., 349 S Biscayne Blvd, Suite 900, Miami, FL 33131, États-Unis.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Propriété intellectuelle</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              L&apos;ensemble du contenu de ce site (textes, images, graphismes, logos, icônes, sons, logiciels) est la propriété exclusive de TravaillerenCi ou de ses partenaires et est protégé par les lois internationales relatives à la propriété intellectuelle.
            </p>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Toute reproduction, représentation, modification, publication, transmission ou dénaturation du site ou de son contenu, par quelque procédé que ce soit, est interdite sans autorisation préalable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Données personnelles</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Conformément à la loi ivoirienne n°2013-450 relative à la protection des données à caractère personnel, vous disposez de droits sur vos données. Pour plus d&apos;informations, consultez notre <Link href="/confidentialite" className="text-primary hover:underline">Politique de confidentialité</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Cookies</h2>
            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              Notre site utilise des cookies pour améliorer l&apos;expérience utilisateur. Consultez notre <Link href="/cookies" className="text-primary hover:underline">Politique de cookies</Link> pour en savoir plus.
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}

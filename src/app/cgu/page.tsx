export const dynamic = "force-dynamic";

export default function CguPage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 bg-gradient-to-br from-white via-gray-50 to-orange-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-orange-950/10 rounded-3xl p-6 sm:p-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-[var(--font-display)]">Conditions Générales d'Utilisation (CGU)</h1>
          <p className="text-sm text-muted-foreground mt-2">Dernière mise à jour : 31 juillet 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">1. Objet</h2>
            <p>
              Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de la plateforme <strong>TravaillerEnCi</strong>, dédiée à la recherche d'emploi, de stages et au recrutement en Côte d'Ivoire. Toute utilisation de la plateforme implique l'acceptation sans réserve des présentes CGU par l'utilisateur (Candidat ou Entreprise).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">2. Règles d'utilisation et interdictions</h2>
            <p>
              L'utilisateur s'engage à utiliser TravaillerEnCi de manière loyale et légale. Il est strictement interdit :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              publishing de fausses annonces d'emploi ou de profils fictifs.
              <li>De diffuser du contenu illégal, injurieux, diffamatoire ou contraire aux bonnes mœurs.</li>
              <li>D'utiliser des robots ou des scripts automatisés non autorisés pour collecter des données personnelles sur la plateforme.</li>
              <li>D'usurper l'identité d'un tiers ou d'une entreprise.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">3. Rôle et Responsabilité de TravaillerEnCi</h2>
            <p>
              TravaillerEnCi agit en tant qu'intermédiaire et agrégateur d'opportunités professionnelles. La plateforme ne garantit pas l'exactitude des offres d'emploi tierces ni l'aboutissement des processus de recrutement. La responsabilité du contenu des offres publiées incombe exclusivement aux recruteurs d'origine.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">4. Droit applicable</h2>
            <p>
              Les présentes CGU sont régies par le droit en vigueur en Côte d'Ivoire. Tout litige relatif à leur interprétation ou à leur exécution relève de la compétence des tribunaux d'Abidjan.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

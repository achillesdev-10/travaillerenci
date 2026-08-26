export const dynamic = "force-dynamic";

export default function PolitiqueConfidentialitePage() {
  return (
    <main className="min-h-screen bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8 bg-gradient-to-br from-white via-gray-50 to-orange-50/40 dark:from-slate-950 dark:via-slate-900 dark:to-orange-950/10 rounded-3xl p-6 sm:p-10">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight font-[var(--font-display)]">Politique de Confidentialité</h1>
          <p className="text-sm text-muted-foreground mt-2">Dernière mise à jour : 31 juillet 2026</p>
        </div>

        <div className="space-y-6 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">1. Données collectées</h2>
            <p>
              Dans le cadre de l'utilisation de TravaillerEnCi, nous collectons des données de navigation anonymes (mesure d'audience, visites) ainsi que les informations fournies volontairement lors de la création de compte : nom, email, numéro WhatsApp, CV et informations de profil pour les candidats, ou nom d'entreprise et descriptions pour les recruteurs.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">2. Utilisation des données</h2>
            <p>
              Les données collectées sont utilisées pour la mise en relation professionnelle entre candidats et entreprises, l'amélioration des services de la plateforme, l'envoi d'alertes emploi pertinentes et l'analyse statistique de la fréquentation du site.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">3. Conformité réglementaire</h2>
            <p>
              TravaillerEnCi s'engage à respecter les principes de protection des données à caractère personnel conformément aux réglementations en vigueur en Côte d'Ivoire (ARTCI) et aux standards internationaux de confidentialité.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">4. Droits des utilisateurs</h2>
            <p>
              Conformément aux lois applicables, vous disposez d'un droit d'accès, de rectification et de suppression de vos données personnelles. Vous pouvez exercer ces droits à tout moment en contactant notre support à l'adresse email : <a href="mailto:achillesdev10@gmail.com" className="text-primary hover:underline">achillesdev10@gmail.com</a>.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

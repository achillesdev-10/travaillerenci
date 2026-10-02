import RegisterForm from '@/components/auth/RegisterForm';

/**
 * Raisons d'inscrire (§6) : la valeur est annoncée AVANT le formulaire.
 * L'utilisateur doit comprendre « pourquoi » avant de remplir un champ.
 */
const REASONS: Array<{ icon: string; text: string }> = [
  { icon: '🔔', text: 'Recevez les nouvelles offres correspondant à votre profil.' },
  { icon: '❤️', text: 'Enregistrez vos offres préférées.' },
  { icon: '👤', text: 'Créez votre profil candidat.' },
  { icon: '🎯', text: 'Recevez des alertes personnalisées.' },
];

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950 px-4 py-10 sm:py-14 text-gray-900 dark:text-slate-50 transition-colors">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
        {/* Colonne « valeur » — visible dès le mobile (compacte), étoffée en desktop */}
        <section aria-labelledby="register-value" className="space-y-4 sm:space-y-5">
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
            Inscription gratuite
          </span>
          <h1
            id="register-value"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight font-[var(--font-display)] text-gray-900 dark:text-white"
          >
            Trouvez votre prochain emploi{' '}
            <span className="text-primary">plus vite</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 max-w-xl leading-relaxed">
            TravaillerEnCi vous aide à trouver des opportunités professionnelles en Côte
            d&apos;Ivoire. Créer un compte, c&apos;est gratuit et ça prend 2 minutes.
          </p>
          <ul className="space-y-2.5">
            {REASONS.map((reason) => (
              <li key={reason.text} className="flex items-start gap-3 text-sm sm:text-[15px] text-gray-700 dark:text-gray-200">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base"
                >
                  {reason.icon}
                </span>
                <span className="leading-snug">{reason.text}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Sans carte bancaire, sans engagement — vous ne recevez que ce qui vous concerne.
          </p>
        </section>

        <div className="mx-auto w-full max-w-md">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}

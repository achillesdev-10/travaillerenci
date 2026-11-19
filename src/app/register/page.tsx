import RegisterForm from '@/components/auth/RegisterForm';

/**
 * Raisons d'inscrire (§6) : la valeur est annoncée AVANT le formulaire.
 * L'utilisateur doit comprendre « pourquoi » avant de remplir un champ.
 */
const REASONS = [
  'Recevez les nouvelles offres correspondant à votre profil.',
  'Enregistrez vos offres préférées.',
  'Créez votre profil candidat.',
  'Recevez des alertes personnalisées.',
];

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-surface dark:bg-slate-950 px-4 py-10 sm:py-14 text-black dark:text-slate-50 transition-colors">
      <div className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-2 lg:gap-14">
        {/* Le formulaire passe en premier sur mobile : moins de friction. */}
        <section
          aria-labelledby="register-value"
          className="order-2 space-y-4 sm:space-y-5 lg:order-1"
        >
          <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20">
            Inscription gratuite
          </span>
          <h1
            id="register-value"
            className="text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight font-[var(--font-display)] text-black dark:text-white"
          >
            Trouvez votre prochain emploi{' '}
            <span className="text-primary">plus vite</span>
          </h1>
          <p className="text-sm sm:text-base text-black dark:text-white max-w-xl leading-relaxed">
            TravaillerEnCi vous aide à trouver des opportunités professionnelles en Côte
            d&apos;Ivoire. Créer un compte, c&apos;est gratuit et ça prend 2 minutes.
          </p>
          <ul className="space-y-3">
            {REASONS.map((reason) => (
              <li key={reason} className="flex items-start gap-3 text-sm text-black dark:text-white sm:text-[15px]">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <span className="leading-snug">{reason}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-black dark:text-white">
            Sans carte bancaire, sans engagement — vous ne recevez que ce qui vous concerne.
          </p>
        </section>

        <div className="order-1 mx-auto w-full max-w-md lg:order-2">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}

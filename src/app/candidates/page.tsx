import Link from 'next/link';
import RegisterForm from '@/components/auth/RegisterForm';
import CoverImage from '@/components/content/CoverImage';
import { IMAGES } from '@/lib/images';

const BENEFITS = [
  {
    title: 'Offres vérifiées',
    description:
      'Chaque offre est contrôlée avant publication pour vous protéger des arnaques et gagner du temps.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Alertes emploi',
    description:
      'Recevez par email les nouvelles offres correspondant à votre profil, dès leur publication.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    title: 'CV en ligne',
    description:
      'Créez un CV professionnel en quelques minutes avec notre générateur intelligent et postulez en un clic.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Bourses & concours',
    description:
      'Ne manquez aucune opportunité : bourses d’études, concours administratifs et admissions sont regroupés ici.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    title: 'Conseils carrière',
    description:
      'Guides, astuces CV et préparation aux entretiens rédigés par des experts du marché ivoirien.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: '100 % gratuit',
    description:
      'L’inscription, la consultation des offres et la candidature sont entièrement gratuites pour les candidats.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const STEPS = [
  {
    number: '1',
    title: 'Créez votre compte gratuit',
    description: 'Inscrivez-vous en moins de 2 minutes avec votre email ou votre compte Google.',
    image: IMAGES.internship,
  },
  {
    number: '2',
    title: 'Complétez votre profil',
    description: 'Ajoutez votre CV, vos compétences et vos préférences pour recevoir les bonnes offres.',
    image: IMAGES.cv,
  },
  {
    number: '3',
    title: 'Postulez en un clic',
    description: 'Parcourez les offres vérifiées et envoyez votre candidature directement aux recruteurs.',
    image: IMAGES.jobsAlt,
  },
];

export const metadata = {
  title: 'Candidats — Trouvez votre emploi en Côte d’Ivoire | TravaillerEnCi',
  description:
    'Créez votre compte gratuit, recevez les offres d’emploi, bourses et concours en Côte d’Ivoire et postulez en un clic.',
};

export default function CandidatesPage() {
  return (
    <div className="text-gray-900 dark:text-slate-50">
      {/* Hero */}
      <section className="relative overflow-hidden bg-orange-50 dark:bg-slate-950">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <nav className="text-sm text-gray-500 mb-8">
            <Link href="/" className="hover:text-primary">
              Accueil
            </Link>
            <span className="mx-2">/</span>
            <span className="text-gray-900 dark:text-white font-medium">Candidats</span>
          </nav>

          <div className="grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
            <div className="max-w-3xl animate-fade-in-up">
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20 mb-5">
                La plateforme n°1 de l’emploi en Côte d’Ivoire
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black font-[var(--font-display)] tracking-tight mb-6">
                Votre carrière{' '}
                <span className="text-secondary">commence ici</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-600 dark:text-slate-400 mb-8 max-w-2xl">
                Rejoignez des milliers de candidats qui trouvent chaque jour un emploi, un stage,
                une bourse d’études ou un concours administratif en Côte d’Ivoire.
              </p>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <a
                  href="#inscription"
                  className="w-full sm:w-auto bg-primary hover:bg-primary-dark text-white px-8 py-4 rounded-2xl font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 transition-all text-center"
                >
                  Créer mon compte gratuit
                </a>
                <Link
                  href="/jobs"
                  className="w-full sm:w-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 hover:border-primary/50 text-gray-900 dark:text-white px-8 py-4 rounded-2xl font-bold transition-all text-center"
                >
                  Voir les offres d’emploi
                </Link>
              </div>
            </div>

            {/* Photo : jeune professionnelle ivoirienne */}
            <div className="relative hidden lg:block">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl shadow-primary/20 ring-1 ring-black/5 animate-float">
                <CoverImage
                  src={IMAGES.hero}
                  alt="Jeune professionnelle ivoirienne qui consulte des offres d'emploi"
                  className="w-full h-[380px] xl:h-[430px] object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/40 via-transparent to-transparent" aria-hidden="true" />
              </div>
              {/* Badge flottant : offres chaque jour */}
              <div className="absolute -left-6 top-8 flex items-center gap-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3 shadow-lg border border-border animate-fade-in-up" style={{ animationDelay: '250ms' }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2Z" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-extrabold text-gray-900 dark:text-white leading-none">Offres chaque jour</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Vérifiées par notre équipe</div>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 md:gap-8 mt-14 max-w-3xl">
            {[
              { value: '50 000+', label: 'Candidats inscrits' },
              { value: '2 000+', label: 'Entreprises actives' },
              { value: '1 500+', label: 'Offres vérifiées' },
            ].map((stat) => (
              <div key={stat.label} className="text-center md:text-left">
                <div className="text-2xl md:text-3xl font-black text-primary font-[var(--font-display)]">
                  {stat.value}
                </div>
                <div className="text-[11px] md:text-xs text-gray-500 dark:text-slate-400 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bénéfices */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl font-bold font-[var(--font-display)] mb-4">
            Pourquoi rejoindre TravaillerEnCi ?
          </h2>
          <p className="text-gray-600 dark:text-slate-400">
            Tout ce qu’il faut pour décrocher le poste de vos rêves, au même endroit.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {BENEFITS.map((benefit) => (
            <div
              key={benefit.title}
              className="rounded-3xl border border-border bg-white dark:bg-slate-900 p-7 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-5">
                {benefit.icon}
              </div>
              <h3 className="font-bold text-lg mb-2">{benefit.title}</h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                {benefit.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="bg-white dark:bg-slate-900 border-y border-border">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-3xl font-bold font-[var(--font-display)] mb-4">
              Comment ça marche ?
            </h2>
            <p className="text-gray-600 dark:text-slate-400">
              Trois étapes suffisent pour commencer votre recherche d’emploi.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {STEPS.map((step) => (
              <div
                key={step.number}
                className="group relative overflow-hidden rounded-3xl border border-border bg-white dark:bg-slate-900 shadow-sm hover:-translate-y-1 hover:shadow-xl transition-all duration-200"
              >
                <div className="relative h-32 sm:h-36 overflow-hidden">
                  <CoverImage
                    src={step.image}
                    alt={step.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" aria-hidden="true" />
                  <div className="absolute left-4 top-4 w-10 h-10 rounded-2xl bg-orange-500 text-white font-black text-lg flex items-center justify-center font-[var(--font-display)] shadow-lg">
                    {step.number}
                  </div>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-600 dark:text-slate-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Témoignage */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto rounded-3xl bg-primary text-white p-8 md:p-12 text-center shadow-2xl">
          <div className="text-5xl mb-4 opacity-40 font-serif leading-none">“</div>
          <blockquote className="text-lg md:text-xl font-medium leading-relaxed mb-6">
            J’ai trouvé mon premier CDI trois semaines après mon inscription. Les alertes par
            email m’ont permis d’être parmi les premiers candidats !
          </blockquote>
          <div className="font-bold">Aya Marie T.</div>
          <div className="text-sm opacity-80">Chargée de communication — Abidjan</div>
        </div>
      </section>

      {/* Inscription */}
      <section id="inscription" className="bg-gray-50 dark:bg-slate-950 border-t border-border">
        <div className="container mx-auto px-4 py-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary border border-primary/20 mb-4">
                Inscription gratuite
              </span>
              <h2 className="text-3xl md:text-4xl font-bold font-[var(--font-display)] mb-4">
                Prêt à lancer votre carrière ?
              </h2>
              <p className="text-gray-600 dark:text-slate-400 text-lg mb-8">
                Créez votre compte en 2 minutes. C’est gratuit, sans engagement, et vous pourrez
                commencer à postuler immédiatement.
              </p>
              <ul className="space-y-3 text-sm">
                {[
                  'Accès illimité à toutes les offres vérifiées',
                  'Alertes personnalisées par email',
                  'Générateur de CV professionnel inclus',
                  'Sans carte bancaire, sans engagement',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-primary mt-0.5 shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700 dark:text-slate-300">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <RegisterForm defaultRole="candidate" />
          </div>
        </div>
      </section>
    </div>
  );
}

import Link from 'next/link';
import { SITE_CONFIG } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Qui sommes-nous ? — TravaillerenCi",
  description:
    "TravaillerenCi, la plateforme 100% ivoirienne des offres d'emploi, de stages, de bourses et de concours. Découvrez l'histoire du projet imaginé par le développeur ivoirien AchillesDev10.",
};

const VALUES = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M20 6 9 17l-5-5" />
      </svg>
    ),
    title: 'Des offres vérifiées',
    text: "Chaque annonce est contrôlée avant publication pour lutter contre les arnaques à l'emploi.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20ZM2 12h20" />
      </svg>
    ),
    title: '100% ivoirien',
    text: 'Conçu à Abidjan, pensé pour les réalités du marché du travail en Côte d’Ivoire.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    title: 'Gratuit et ouvert',
    text: "La recherche d'emploi ne doit pas être un luxe : l'accès aux offres est entièrement gratuit.",
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
      </svg>
    ),
    title: 'Simple et rapide',
    text: 'Postulez en quelques clics, sans compte obligatoire pour consulter les offres.',
  },
];

const JOURNEY = [
  {
    period: 'La genèse',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M9 18h6M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2Z" />
      </svg>
    ),
    title: 'Un constat simple',
    text: "En Côte d'Ivoire, l'information sur les opportunités professionnelles est dispersée entre les sites des entreprises, les réseaux sociaux et le bouche-à-oreille. De nombreux talents qualifiés passent à côté d'offres correspondant pourtant à leur profil.",
  },
  {
    period: 'La solution',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76Z" />
      </svg>
    ),
    title: 'Une plateforme unique',
    text: 'TravaillerenCi centralise les offres d’emploi, de stages, de bourses et de concours administratifs en un seul endroit, avec un scraping automatisé des sources publiques et une modération humaine de chaque contenu.',
  },
  {
    period: "Aujourd'hui",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="m12 2-1 3.5L9 7l3.5 1L13 12l1-4L17.5 7 15 5.5 12 2Z" />
        <path d="M4 13l2 2 2-2M4 18l2 2 2-2" />
      </svg>
    ),
    title: 'Un projet vivant',
    text: "La plateforme évolue en continu : générateur de CV intelligent, alertes personnalisées, et bientôt de nouvelles fonctionnalités pour les candidats comme pour les recruteurs ivoiriens.",
  },
];

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* ===== En-tête ===== */}
      <section className="relative overflow-hidden border-b border-border/40 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto px-4 py-14 sm:py-20 relative z-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary dark:text-brand-accent px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20ZM2 12h20" />
            </svg>
            À propos de TravaillerenCi
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-[var(--font-display)] text-black dark:text-white">
            Qui sommes-nous&nbsp;?
          </h1>
          <p className="mt-4 text-base sm:text-lg text-black dark:text-white max-w-2xl mx-auto leading-relaxed">
            TravaillerenCi est une plateforme <strong>100% ivoirienne</strong> qui connecte les
            talents aux opportunités : emplois, stages, bourses d’études et concours
            administratifs, réunis au même endroit.
          </p>
        </div>
      </section>

      {/* ===== Article / histoire ===== */}
      <section className="container mx-auto px-4 py-12 sm:py-16 max-w-4xl">
        <div>
          <article className="space-y-6 text-[15px] sm:text-base leading-relaxed text-black dark:text-white">
            <p>
              <strong className="text-black dark:text-white">TravaillerenCi</strong> est né
              d’une idée simple : <em>«&nbsp;Chaque Ivoirien mérite de trouver sa voie
              professionnelle sans se heurter à la désinformation ou aux annonces fantômes.&nbsp;»</em>{' '}
              Le projet a été imaginé, conçu et développé par un développeur ivoirien passionné,
              connu sous le pseudo <strong className="text-black dark:text-white">AchillesDev10</strong>.
            </p>
            <p>
              Partant du constat que les candidats perdent un temps précieux à éplucher des
              dizaines de sites pour trouver une simple offre correspondant à leur profil,
              AchillesDev10 a décidé de créer une plateforme centralisée, moderne et fiable :
              un véritable <strong className="text-black dark:text-white">pont numérique</strong>{' '}
              entre les recruteurs et les talents de Côte d’Ivoire.
            </p>
            <p>
              Aujourd’hui, TravaillerenCi agrège automatiquement les offres publiées par les
              entreprises, les institutions et les organismes de formation, puis soumet chaque
              contenu à une <strong className="text-black dark:text-white">vérification humaine</strong>{' '}
              avant publication. Les utilisateurs peuvent ainsi rechercher un emploi, un stage,
              une bourse ou un concours en toute confiance.
            </p>
            <p>
              La plateforme propose également des outils pensés pour le marché local, comme un{' '}
              <Link href="/generateur-de-cv" className="text-primary font-semibold hover:underline">
                générateur de CV
              </Link>{' '}
              assisté par intelligence artificielle, pour aider chaque candidat à valoriser son
              parcours.
            </p>
          </article>
        </div>

        {/* ===== Parcours ===== */}
        <div className="mt-14 grid gap-5 sm:gap-6">
          {JOURNEY.map((step, i) => (
            <div
              key={step.title}
              className="relative bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 sm:p-8 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
                <div className="shrink-0 w-14 h-14 rounded-2xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary">
                  <span aria-hidden="true">{step.icon}</span>
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-widest text-primary mb-1">
                    {String(i + 1).padStart(2, '0')} — {step.period}
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-black dark:text-white font-[var(--font-display)]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-black dark:text-white leading-relaxed">
                    {step.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ===== Valeurs ===== */}
        <div className="mt-14">
          <h2 className="text-2xl font-extrabold text-black dark:text-white font-[var(--font-display)] mb-6">
            Nos engagements
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
            {VALUES.map((v) => (
              <div
                key={v.title}
                className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-5 sm:p-6 hover:border-primary/30 transition-colors"
              >
                <div className="text-primary mb-3" aria-hidden="true">
                  {v.icon}
                </div>
                <h3 className="font-bold text-black dark:text-white">{v.title}</h3>
                <p className="mt-1.5 text-sm text-black dark:text-white leading-relaxed">{v.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ===== CTA ===== */}
        <div className="mt-14 rounded-3xl bg-primary p-8 sm:p-10 text-center text-white shadow-xl shadow-primary/20">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-[var(--font-display)]">
            Prêt à booster votre carrière&nbsp;?
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/85 max-w-xl mx-auto">
            Parcourez les dernières offres vérifiées ou créez votre CV professionnel en quelques minutes.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-black font-bold text-sm hover:bg-gray-100 transition-colors shadow-lg"
            >
              Voir les offres
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/generateur-de-cv"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-white/30 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M9 13h6M9 17h4" />
              </svg>
              Créer mon CV
            </Link>
          </div>
        </div>

        {/* ===== Contact ===== */}
        <div className="mt-10 text-center">
          <p className="text-sm text-black dark:text-white">
            Une question, une suggestion&nbsp;? Écrivez-nous à{' '}
            <a href={`mailto:${SITE_CONFIG.supportEmail}`} className="text-primary font-semibold hover:underline">
              {SITE_CONFIG.supportEmail}
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

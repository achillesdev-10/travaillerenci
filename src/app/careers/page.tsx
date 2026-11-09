import { SITE_CONFIG } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: "Carrières chez TravaillerenCi",
  description:
    "Vous souhaitez travailler avec TravaillerenCi ? Développeurs, commerciaux, contributeurs ou partenaires : contactez-nous par email à achillesdev10@gmail.com.",
};

const REASONS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="m12 2-1 3.5L9 7l3.5 1L13 12l1-4L17.5 7 15 5.5 12 2ZM3 13l3.5 3.5L4 20l3.5-1 1.5 3 1.5-3 3.5 1-2.5-3.5L15 13l-3 1-3-1-3-1ZM19 11l1.2 3L23 15l-2.8 1L19 19l-1.2-3L15 15l2.8-1 1.2-3Z" />
      </svg>
    ),
    title: 'Un projet en pleine croissance',
    text: 'TravaillerenCi évolue chaque semaine : nouvelles fonctionnalités, nouveaux contenus et une audience qui grandit. C’est le moment idéal pour rejoindre l’aventure.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M9 18h6M10 22h4" />
        <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2Z" />
      </svg>
    ),
    title: 'Des idées à construire',
    text: 'Nous sommes ouverts aux profils créatifs qui veulent améliorer l’employabilité des jeunes Ivoiriens, que ce soit sur le produit, le design, le marketing ou la technique.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M18 21a3 3 0 0 0 3-3v-3a3 3 0 0 0-3-3h-1v3a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8" />
        <path d="M6 3 3 6l3 3" />
        <path d="M6 3v7.5A3.5 3.5 0 0 0 9.5 14H14a2 2 0 0 1 2 2v.5" />
      </svg>
    ),
    title: 'Un fonctionnement collaboratif',
    text: 'En tant que jeune équipe, nous privilégions l’échange, la transparence et l’impact concret. Votre avis compte vraiment dans les décisions.',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
        <path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10Z" />
        <path d="M9.5 11.5 11 13l3.5-3.5" />
      </svg>
    ),
    title: 'Un impact local réel',
    text: 'Chaque mission accomplie aide des milliers de candidats à trouver un emploi, un stage ou une formation en Côte d’Ivoire.',
  },
];

const OPPORTUNITIES = [
  {
    role: 'Développeur web (React / Next.js)',
    type: 'Contribution / Freelance',
    description:
      'Améliorer le produit : nouvelles pages, optimisation des performances, outils pour les candidats et les recruteurs.',
  },
  {
    role: 'Rédacteur & community manager',
    type: 'Contribution / Freelance',
    description:
      'Alimenter le blog, créer des contenus utiles pour les chercheurs d’emploi et animer la communauté sur les réseaux sociaux.',
  },
  {
    role: 'Chasseur de talents / Partenaire recruteur',
    type: 'Partenariat',
    description:
      'Entreprises, cabinets de recrutement ou écoles : publiez vos offres et touchez des milliers de candidats qualifiés.',
  },
  {
    role: 'Ambassadeur campus',
    type: 'Bénévolat',
    description:
      'Étudiants en Côte d’Ivoire : faites connaître la plateforme dans votre université et aidez vos camarades à trouver des stages.',
  },
];

export default function CareersPage() {
  return (
    <main className="min-h-screen bg-brand-soft/50 dark:bg-slate-950">
      {/* ===== En-tête ===== */}
      <section className="relative overflow-hidden border-b border-border/40 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto px-4 py-14 sm:py-20 relative z-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary dark:text-brand-accent px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M18 21a3 3 0 0 0 3-3v-3a3 3 0 0 0-3-3h-1v3a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V8" />
              <path d="M6 3 3 6l3 3" />
              <path d="M6 3v7.5A3.5 3.5 0 0 0 9.5 14H14a2 2 0 0 1 2 2v.5" />
            </svg>
            Rejoignez l'équipe
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-[var(--font-display)] text-black dark:text-white">
            Carrières chez <span className="text-primary">TravaillerenCi</span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-black dark:text-white max-w-2xl mx-auto leading-relaxed">
            Vous souhaitez <strong>travailler avec nous</strong>, contribuer au projet ou obtenir
            plus d’informations&nbsp;? Nous serions ravis d’échanger avec vous.
          </p>
          <div className="mt-7 inline-flex items-center gap-3 rounded-2xl bg-white dark:bg-slate-900 border border-border px-5 py-4 shadow-md">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-primary" aria-hidden="true">
              <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8" />
              <path d="M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
            </svg>
            <div className="text-left">
              <div className="text-[11px] uppercase tracking-widest text-black dark:text-white font-semibold">
                Écrivez-nous à
              </div>
              <a
                href={`mailto:${SITE_CONFIG.supportEmail}?subject=${encodeURIComponent('Candidature / Partenariat TravaillerenCi')}`}
                className="text-base sm:text-lg font-bold text-primary hover:underline break-all"
              >
                {SITE_CONFIG.supportEmail}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Pourquoi nous rejoindre ===== */}
      <section className="container mx-auto px-4 py-12 sm:py-16 max-w-5xl">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white font-[var(--font-display)] text-center mb-8">
          Pourquoi nous rejoindre&nbsp;?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {REASONS.map((r) => (
            <div
              key={r.title}
              className="bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="text-primary mb-3" aria-hidden="true">
                {r.icon}
              </div>
              <h3 className="font-bold text-black dark:text-white">{r.title}</h3>
              <p className="mt-1.5 text-sm text-black dark:text-white leading-relaxed">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Opportunités ===== */}
      <section className="container mx-auto px-4 pb-12 sm:pb-16 max-w-5xl">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-black dark:text-white font-[var(--font-display)] text-center mb-3">
          Où pouvons-nous collaborer&nbsp;?
        </h2>
        <p className="text-center text-sm text-black dark:text-white max-w-2xl mx-auto mb-8">
          Profils en recherche active ou simples coups de main ponctuels, toutes les bonnes
          volontés sont les bienvenues. Envoyez-nous simplement un email.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
          {OPPORTUNITIES.map((o) => (
            <div
              key={o.role}
              className="flex flex-col bg-white dark:bg-slate-900 border border-border rounded-2xl p-6 hover:border-primary/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold text-black dark:text-white leading-snug">{o.role}</h3>
                <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 text-primary text-[11px] font-bold px-2.5 py-1">
                  {o.type}
                </span>
              </div>
              <p className="mt-2 text-sm text-black dark:text-white leading-relaxed flex-1">
                {o.description}
              </p>
              <a
                href={`mailto:${SITE_CONFIG.supportEmail}?subject=${encodeURIComponent(`Candidature : ${o.role}`)}`}
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
              >
                Candidater par email
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA final ===== */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24 max-w-4xl">
        <div className="rounded-3xl bg-primary p-8 sm:p-10 text-center text-white shadow-xl shadow-primary/20">
          <h2 className="text-2xl sm:text-3xl font-extrabold font-[var(--font-display)]">
            Envoyez-nous votre candidature
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/85 max-w-xl mx-auto">
            Développeurs, rédacteurs, étudiants, entreprises&nbsp;: présentez-nous votre parcours
            et votre motivation par email. Nous répondons à tous les messages.
          </p>
          <a
            href={`mailto:${SITE_CONFIG.supportEmail}?subject=${encodeURIComponent('Je souhaite travailler avec TravaillerenCi')}`}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 text-black font-bold text-sm hover:bg-brand-soft transition-colors shadow-lg"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            {SITE_CONFIG.supportEmail}
          </a>
          <div className="mt-4 text-xs text-white/70">
            Sujet suggéré : « Je souhaite travailler avec TravaillerenCi »
          </div>
        </div>
      </section>
    </main>
  );
}

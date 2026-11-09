import Link from 'next/link';
import type { ReactNode } from 'react';
import CoverImage from '@/components/content/CoverImage';
import SearchBar from '@/components/jobs/SearchBar';
import { getCachedJobs, getCachedExams, getCachedPosts } from '@/lib/cachedContent';
import type { JobOfferSchema } from '@/types';
import NewsTicker, { type TickerItem } from '@/components/home/NewsTicker';
import HomeCarousel from '@/components/home/HomeCarousel';
import PollWidget from '@/components/home/PollWidgetLazy';
import OffersGrid from '@/components/home/OffersGrid';
import ForumSection from '@/components/home/ForumSection';
import SocialLinks from '@/components/layout/SocialLinks';
import { buildCarouselSlides } from '@/lib/homeCarousel';
import { IMAGES, LOCAL_IMAGES } from '@/lib/images';
import { getSiteUrl } from '@/lib/site';

export const revalidate = 60;

// Major cities in Côte d'Ivoire for job discovery by location
const CITIES = [
  { name: 'Abidjan' },
  { name: 'Bouaké' },
  { name: 'Yamoussoukro' },
  { name: 'San-Pédro' },
  { name: 'Korhogo' },
  { name: 'Daloa' },
];

/** Bénéfices d'un compte candidat — section « Pourquoi créer un compte ? » (§19). */
const ACCOUNT_BENEFITS: Array<{ icon: string; title: string; description: string }> = [
  {
    icon: '❤️',
    title: 'Sauvegarder vos offres',
    description: 'Mettez de côté les offres et stages qui vous intéressent, retrouvez-les en un clic.',
  },
  {
    icon: '🔔',
    title: 'Recevoir des alertes',
    description: "Soyez prévenu dès qu'une offre correspond à votre métier, votre ville ou votre contrat.",
  },
  {
    icon: '👤',
    title: 'Créer votre profil candidat',
    description: 'Ville, métier, expérience, compétences : un profil qui rend vos offres plus pertinentes.',
  },
  {
    icon: '📄',
    title: 'Retrouver votre CV',
    description: 'Générez votre CV en ligne et conservez le lien de téléchargement à portée de main.',
  },
  {
    icon: '🎯',
    title: 'Recevoir des offres recommandées',
    description: 'Une sélection automatique de postes qui correspondent vraiment à votre profil.',
  },
];

const QUICK_LINKS = [
  {
    label: 'Offres d\u2019emploi',
    desc: 'CDI, CDD, prestation',
    href: '/jobs',
    color: 'bg-brand',
    image: IMAGES.jobs,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    ),
  },
  {
    label: 'Stages',
    desc: 'Pour étudiants & jeunes diplômés',
    href: '/jobs?contract=Stage',
    color: 'bg-brand',
    image: IMAGES.internship,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow">
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12v5c0 1 2.7 3 6 3s6-2 6-3v-5" />
      </svg>
    ),
  },
  {
    label: 'Bourses d\u2019études',
    desc: 'Étudier en CI & à l\u2019étranger',
    href: '/bourses',
    color: 'bg-brand',
    image: IMAGES.scholarship,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow">
        <path d="M22 10 12 5 2 10l10 5 10-5Z" />
        <path d="M6 12.5v4.5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-4.5" />
        <path d="M22 10v5" />
      </svg>
    ),
  },
  {
    label: 'Concours admin.',
    desc: 'ENA, INFAS, CAFOP\u2026',
    href: '/concours',
    color: 'bg-brand',
    image: IMAGES.concours,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow">
        <path d="M3 21h18" />
        <path d="M4 21V10l8-6 8 6v11" />
        <path d="M9 21v-6h6v6" />
      </svg>
    ),
  },
  {
    label: 'Générateur de CV',
    desc: 'Un CV pro avec l\u2019IA',
    href: '/generateur-de-cv',
    color: 'bg-brand',
    image: IMAGES.cv,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M14 2v6h6" />
        <path d="M9 13h6M9 17h4" />
      </svg>
    ),
  },
  {
    label: 'Conseils & Blog',
    desc: 'Astuces candidature',
    href: '/blog',
    color: 'bg-brand',
    image: IMAGES.blog,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 sm:h-7 sm:w-7 drop-shadow">
        <path d="M15 12h-5M15 8h-5M8 3h5.6a1 1 0 0 1 .7.3l3.4 3.4a1 1 0 0 1 .3.7V21a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      </svg>
    ),
  },
];

// Secteurs populaires mis en avant sur la home (photos + comptage approximatif
// fourni par le service — basé sur les filtres du moteur de recherche).
// Secteurs populaires mis en avant sur la home — le mot-clé `q` est celui
// du moteur de recherche (filtre titre/entreprise/description), d'où des
// termes réels (développeur, banque…) plutôt que des slugs de catégorie.
// Secteurs populaires mis en avant sur la home — les 4 secteurs « cartes
// filtres » (tech, commercial, logistique, BTP/ingénierie) utilisent les
// nouvelles images locales optimisées via next/image.
const POPULAR_SECTORS = [
  { q: 'développeur', name: 'IT / Digital', image: LOCAL_IMAGES.categoryTech },
  { q: 'banque', name: 'Banque / Finance', image: IMAGES.banque },
  { q: 'infirmier', name: 'Santé', image: IMAGES.sante },
  { q: 'enseignant', name: 'Éducation / Formation', image: IMAGES.education },
  { q: 'commercial', name: 'Commerce / Distribution', image: LOCAL_IMAGES.categoryCommercial },
  { q: 'chantier', name: 'BTP / Immobilier', image: LOCAL_IMAGES.categoryEngineering },
  { q: 'ingénieur', name: 'Industrie', image: IMAGES.industrie },
  { q: 'chauffeur', name: 'Transport / Logistique', image: LOCAL_IMAGES.categoryLogistics },
];

// Les 3 étapes du parcours candidat, illustrées par des photos.
const HOW_IT_WORKS = [
  {
    title: 'Créez votre CV pro',
    desc: "Générateur de CV par IA : un CV clair, moderne et adapté au marché ivoirien en quelques minutes.",
    href: '/generateur-de-cv',
    cta: 'Générer mon CV',
    image: IMAGES.cv,
  },
  {
    title: 'Trouvez votre opportunité',
    desc: 'Offres vérifiées, bourses et concours actualisés chaque jour — filtrez par ville, secteur et contrat.',
    href: '/jobs',
    cta: 'Voir les offres',
    image: IMAGES.jobsAlt,
  },
  {
    title: 'Postulez en 1 clic',
    desc: "Envoyez votre candidature, activez des alertes et soyez prévenu dès qu'une offre vous correspond.",
    href: '/register',
    cta: 'Créer un compte',
    image: IMAGES.blogAlt,
  },
];

export default async function HomePage() {
  // ISR : la page d'accueil est la page la plus visitée du site (max CPU
  // Vercel). Elle est désormais 100 % statique/ISR (revalidate = 60) :
  // la recherche n'y est plus traitée côté serveur — la SearchBar renvoie
  // vers /jobs?q=… (recherche canonique du site, cf. JSON-LD SearchAction).
  // Motivation : toute lecture de `searchParams` rendait la page dynamique
  // et re-rendait tout le HTML à chaque visite (quota CPU 94 %).
  const [jobs, examRows, blogRows, bourseRows] = await Promise.all([
    getCachedJobs({
      status: 'published',
      limit: 60,
      order_by: 'created_at',
      order_dir: 'desc',
      fields: 'card',
    }),
    getCachedExams({
      status: 'published',
      limit: 6,
      order_by: 'created_at',
      order_dir: 'desc',
      fields: 'card',
    }),
    getCachedPosts({
      status: 'published',
      limit: 4,
      order_by: 'published_at',
      order_dir: 'desc',
      fields: 'card',
    }),
    getCachedJobs({
      category: 'scholarship',
      status: 'published',
      limit: 4,
      order_by: 'created_at',
      order_dir: 'desc',
      fields: 'card',
    }),
  ]);

  const { rows: jobsList, total } = jobs;
  const totalKnown = Math.max(total, jobsList.length);

  // Carrousel « À la une » construit CÔTÉ SERVEUR : les titres des opportunités
  // sont ainsi présents dans le HTML brut (SEO / partage), au lieu d'un
  // « Chargement des opportunités… » côté client. On réutilise les données déjà
  // chargées ci-dessus (offres du fil actu, concours, blog) pour éviter des
  // requêtes redondantes — sauf en cas de recherche active, où le carrousel
  // doit rester sur les dernières opportunités publiées (re-fetch ciblé).
  const carousel = await buildCarouselSlides({
    withOgImages: false,
    // 6 slides max : chaque slide cachée (opacity-0) reste dans le DOM pour
    // le SEO — moins de slides = moins de nœuds DOM inutiles.
    maxSlides: 6,
    offers: jobsList as JobOfferSchema[],
    exams: examRows.rows,
    posts: blogRows.rows,
  });

  const tickerItems: TickerItem[] = [
    ...jobsList.slice(0, 5).map((job) => ({
      id: `job-${job.id}`,
      title: job.title,
      href: `/jobs/${job.id}`,
      type: 'offre' as const,
    })),
    ...examRows.rows.slice(0, 4).map((exam) => ({
      id: `exam-${exam.id}`,
      title: exam.title,
      href: `/concours/${exam.slug || exam.id}`,
      type: 'concours' as const,
    })),
    ...bourseRows.rows.slice(0, 3).map((bourse) => ({
      id: `bourse-${bourse.id}`,
      title: bourse.title,
      href: `/bourses/${bourse.id}`,
      type: 'bourse' as const,
    })),
    ...blogRows.rows.slice(0, 3).map((post) => ({
      id: `post-${post.id}`,
      title: post.title,
      href: `/blog/${post.slug}`,
      type: 'blog' as const,
    })),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'TravaillerenCi',
    alternateName: 'TravaillerEnCi',
    url: getSiteUrl(),
    inLanguage: 'fr-CI',
    description:
      "Plateforme d'offres d'emploi, de stages, de bourses et de concours administratifs en Côte d'Ivoire.",
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${getSiteUrl()}/jobs?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <main id="main-content" className="flex-1 min-h-screen bg-white dark:bg-slate-950 transition-colors">
      {/* JSON-LD (SEO) : WebSite + SearchAction */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ======================================================================== */}
      {/*   FIL ACTU (sous la barre de navigation) : offres, concours, bourses…     */}
      {/* ======================================================================== */}
      <NewsTicker items={tickerItems} />
      {/* ======================================================================== */}
      {/*   HERO — Mobile-first : texte lisible, peu de padding vertical            */}
      {/* ======================================================================== */}
      <section className="relative overflow-hidden bg-white dark:bg-slate-950 pt-10 pb-10 sm:pt-16 sm:pb-14 border-b border-line dark:border-slate-800">
        <div className="container mx-auto px-4 relative z-10 max-w-5xl">
          <div className="max-w-3xl mx-auto">
            <div className="text-center animate-fade-in-up">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary dark:text-brand-accent px-3.5 py-1.5 rounded-full text-[12px] sm:text-sm font-semibold mb-4 sm:mb-5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Plateforme 100% ivoirienne
              </div>

              <h1 className="text-[28px] leading-[1.15] sm:text-4xl lg:text-[44px] xl:text-5xl font-extrabold mb-3 sm:mb-5 font-[var(--font-display)] text-black dark:text-white">
                TravaillerEn<span className="text-primary">Ci</span>
                <span className="block text-black dark:text-white text-[22px] sm:text-3xl lg:text-[32px] mt-1 sm:mt-2">
                  Trouvez un job qui <span className="text-primary">vaut le coup</span>
                </span>
              </h1>

              <p className="text-[15px] sm:text-lg text-black dark:text-white max-w-2xl mx-auto leading-relaxed">
                <strong className="text-black dark:text-white">
                  TravaillerEnCi vous aide à trouver des opportunités professionnelles en Côte
                  d&apos;Ivoire.
                </strong>{' '}
                Des <strong className="text-black dark:text-white">offres vérifiées</strong>, des
                entreprises de confiance, et zéro spam. Postulez simplement — on s&apos;occupe du
                reste.
              </p>

              {/* Ce que la plateforme fait pour vous (§18) — offres, stages,
                  recherche, alertes, CV, profil candidat. */}
              <ul
                aria-label="Ce que vous pouvez faire sur TravaillerEnCi"
                className="mt-4 flex flex-wrap items-center justify-center gap-2"
              >
                {[
                  { label: 'Offres', href: '/jobs' },
                  { label: 'Stages', href: '/stages' },
                  { label: 'Recherche', href: '/jobs' },
                  { label: 'Alertes emploi', href: '/dashboard/candidate' },
                  { label: 'Mon CV', href: '/generateur-de-cv' },
                  { label: 'Profil candidat', href: '/register' },
                ].map((feature) => (
                  <li key={feature.label}>
                    <Link
                      href={feature.href}
                      className="inline-flex items-center rounded-full border border-line bg-white px-3 py-1.5 text-[12px] sm:text-[13px] font-semibold text-black transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                    >
                      {feature.label}
                    </Link>
                  </li>
                ))}
              </ul>

              {/* CTA principal — de visiteur à compte (§18) */}
              <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
                >
                  Créer mon profil
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  href="/jobs"
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  Voir les offres
                </Link>
                <Link
                  href="/jobs/today"
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:border-primary/50 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  Offres du jour
                </Link>
              </div>
            </div>
          </div>

          {/* Barre de recherche pleine largeur — rendue dans le HTML initial
              (pas de Suspense : la barre est l'élément LCP et ne doit pas
              dépendre de l'hydratation pour s'afficher) */}
          <div className="mt-8 sm:mt-10 max-w-2xl mx-auto">
            <SearchBar targetPath="/jobs" />

            <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-[12px] sm:text-sm text-black dark:text-white">
              <Stat
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-brand">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                }
                label="Offres vérifiées"
              />
              <Stat
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-orange-500">
                    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
                  </svg>
                }
                label="Réponse rapide"
              />
              <Stat
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-primary">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20ZM2 12h20" />
                  </svg>
                }
                label="100% Côte d'Ivoire"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   CHIFFRES CLÉS — compteurs réels issus de la BDD                      */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 py-8 sm:py-10 max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <HomeStat
            value={totalKnown}
            suffix="+"
            label="Offres d'emploi"
            href="/jobs"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
            }
          />
          <HomeStat
            value={examRows.total}
            suffix=""
            label="Concours suivis"
            href="/concours"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M3 21h18" />
                <path d="M4 21V10l8-6 8 6v11" />
                <path d="M9 21v-6h6v6" />
              </svg>
            }
          />
          <HomeStat
            value={bourseRows.total}
            suffix=""
            label="Bourses d'études"
            href="/bourses"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M22 10 12 5 2 10l10 5 10-5Z" />
                <path d="M6 12.5v4.5c0 1.2 2.7 2.5 6 2.5s6-1.3 6-2.5v-4.5" />
                <path d="M22 10v5" />
              </svg>
            }
          />
          <HomeStat
            value={blogRows.total}
            suffix=""
            label="Conseils & articles"
            href="/blog"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden="true">
                <path d="M15 12h-5M15 8h-5M8 3h5.6a1 1 0 0 1 .7.3l3.4 3.4a1 1 0 0 1 .3.7V21a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
              </svg>
            }
          />
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   WIDGETS : carrousel (images des sources) + sondage                     */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 mt-8 sm:mt-12 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
          <div className="lg:col-span-2 animate-fade-in-up">
            <SectionHeading
              kicker="À la une"
              title="Les opportunités du moment"
              actionHref="/jobs"
              actionLabel="Tout voir"
            />
            <HomeCarousel slides={carousel.slides} />
          </div>
          <div className="animate-fade-in-up" style={{ animationDelay: '120ms' }}>
            <PollWidget />
          </div>
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   ACCÈS RAPIDES : catégories colorées (2 colonnes sur mobile)            */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 mt-10 sm:mt-14 max-w-6xl">
        <SectionHeading kicker="Explorez" title="Où voulez-vous commencer ?" />
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
          {QUICK_LINKS.map((link, i) => (
            <Link
              key={link.label}
              href={link.href}
              className="group flex items-start gap-3 rounded-xl border border-line bg-white p-4 transition-colors hover:border-primary/40 hover:bg-brand-soft/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary [&_svg]:h-5 [&_svg]:w-5">
                <span aria-hidden="true">{link.icon}</span>
              </span>
              <span className="min-w-0">
                <span className="block font-[var(--font-display)] text-sm font-bold leading-tight text-black dark:text-white group-hover:text-primary">
                  {link.label}
                </span>
                <span className="mt-0.5 block text-[11px] sm:text-xs leading-tight text-black dark:text-white">
                  {link.desc}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   SECTEURS POPULAIRES — grille photos                                    */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 mt-10 sm:mt-14 max-w-6xl">
        <SectionHeading
          kicker="Par secteur"
          title="Explorez les secteurs qui recrutent"
          actionHref="/jobs"
          actionLabel="Toutes les offres"
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {POPULAR_SECTORS.map((sector, i) => (
            <Link
              key={sector.q}
              href={`/jobs?q=${encodeURIComponent(sector.q)}`}
              className="group flex items-center justify-between gap-2 rounded-xl border border-line bg-white px-4 py-3.5 transition-colors hover:border-primary/40 hover:bg-brand-soft/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <span className="truncate font-[var(--font-display)] text-sm font-bold text-black dark:text-white group-hover:text-primary">
                  {sector.name}
                </span>
              </span>
              <svg className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          ))}
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   EMPLOIS PAR VILLE — navigation par localisation                        */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 mt-10 sm:mt-14 max-w-6xl">
        <SectionHeading
          kicker="Par ville"
          title="Trouvez un emploi près de chez vous"
          actionHref="/jobs"
          actionLabel="Toutes les villes"
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          {CITIES.map((city, i) => (
            <Link
              key={city.name}
              href={`/jobs?city=${encodeURIComponent(city.name)}`}
              className="group flex items-center gap-2.5 rounded-xl border border-line bg-white px-3.5 py-3 transition-colors hover:border-primary/40 hover:bg-brand-soft/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800 animate-fade-in-up"
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary dark:text-brand-accent">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <span className="text-[13px] font-semibold text-black dark:text-white group-hover:text-primary transition-colors truncate">
                {city.name}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   FORUM / Q&A — Questions de la communauté                              */}
      {/* ======================================================================== */}
      <ForumSection />

      {/* ======================================================================== */}
      {/*   OFFRE À LA UNE — grille 2 colonnes dès le mobile                        */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 pb-10 sm:pb-14 max-w-6xl mt-12 sm:mt-16 pt-10 sm:pt-12 border-t border-line dark:border-slate-800">
        <div className="flex items-end justify-between gap-3 mb-4 sm:mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white font-[var(--font-display)]">
              Dernières offres
            </h2>
            <p className="text-sm text-black dark:text-white mt-1">
              Les dernières opportunités publiées sur TravaillerenCi
            </p>
          </div>
          <Link
            href="/jobs"
            className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:gap-2 transition-all"
          >
            Tout voir
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        {jobsList.length === 0 ? (
          <EmptyState />
        ) : (
          <OffersGrid jobs={jobsList as JobOfferSchema[]} />
        )}
      </section>

      {/* ======================================================================== */}
      {/*   DERNIERS ARTICLES DU BLOG — 2 colonnes dès le mobile                    */}
      {/* ======================================================================== */}
      {blogRows.rows.length > 0 && (
        <section className="container mx-auto px-4 pb-16 sm:pb-24 max-w-6xl">
          <SectionHeading
            kicker="Le blog"
            title="Conseils & actualités"
            actionHref="/blog"
            actionLabel="Tous les articles"
          />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {blogRows.rows.map((post, i) => (
              <HomeBlogCard key={post.id} post={post} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ======================================================================== */}
      {/*   COMMENT ÇA MARCHE — 3 étapes illustrées                                */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24 max-w-6xl">
        <SectionHeading kicker="Simple & rapide" title="Comment ça marche ?" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
          {HOW_IT_WORKS.map((step, i) => (
            <div
              key={step.title}
              className="rounded-xl border border-line bg-white p-5 dark:border-slate-800 dark:bg-slate-900 animate-fade-in-up"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-black text-white font-[var(--font-display)]">
                {i + 1}
              </span>
              <h3 className="mt-4 font-[var(--font-display)] text-base sm:text-lg font-extrabold text-black dark:text-white mb-1.5">
                {step.title}
              </h3>
              <p className="text-sm text-black dark:text-white leading-relaxed">{step.desc}</p>
              <Link
                href={step.href}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:gap-2.5 transition-all"
              >
                {step.cta}
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   SUIVEZ-NOUS — réseaux sociaux du moment                                */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24 max-w-6xl">
        <div className="rounded-2xl bg-black text-white">
          <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-10 px-6 py-10 sm:p-12">
            <div className="text-center lg:text-left flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-brand-accent mb-2">Suivez-nous</p>
              <h2 className="font-[var(--font-display)] text-2xl sm:text-3xl font-extrabold leading-tight">
                Rejoignez la communauté
              </h2>
              <p className="mt-2 text-sm sm:text-base text-white/80 max-w-xl mx-auto lg:mx-0">
                Nouveaux concours, bourses et offres en avant-première sur nos réseaux sociaux.
              </p>
            </div>
            <SocialLinks size="md" className="gap-3 sm:gap-4 justify-center" />
          </div>
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   POURQUOI CRÉER UN COMPTE — bénéfices (§19)                           */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24 max-w-6xl" aria-labelledby="pourquoi-compte">
        <div className="rounded-2xl border border-line bg-white p-6 sm:p-10 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-brand-accent mb-1">
            Votre espace personnel
          </p>
          <h2
            id="pourquoi-compte"
            className="text-lg sm:text-2xl font-bold text-black dark:text-white font-[var(--font-display)] leading-tight mb-2"
          >
            Pourquoi créer un compte ?
          </h2>
          <p className="max-w-2xl text-sm text-black dark:text-white mb-6">
            Gratuitement, votre compte transforme la recherche en routine efficace : vous ne
            repartez jamais les mains vides.
          </p>

          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ACCOUNT_BENEFITS.map((benefit) => (
              <li
                key={benefit.title}
                className="flex gap-3 rounded-xl border border-line bg-brand-soft/30 p-4 dark:border-slate-800 dark:bg-slate-950/60"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-lg"
                >
                  {benefit.icon}
                </span>
                <span>
                  <span className="block text-sm font-bold text-black dark:text-white">
                    {benefit.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-black dark:text-white">
                    {benefit.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-white transition-colors hover:bg-primary-dark"
            >
              Créer mon compte gratuitement
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-line px-6 py-3 text-sm font-bold text-black transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-white"
            >
              J'ai déjà un compte
            </Link>
          </div>
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   BANDEAU CTA                                                             */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24 max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 sm:p-12 text-center text-white shadow-xl shadow-primary/20">
          <div className="relative">
            <h2 className="font-[var(--font-display)] text-2xl sm:text-4xl font-extrabold mb-3">
              Prêt à décrocher votre prochain job ?
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-white mb-6">
              Créez un CV professionnel en quelques minutes avec notre générateur IA,
              puis postulez aux meilleures offres en Côte d'Ivoire.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/generateur-de-cv"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-primary shadow-lg transition-transform hover:scale-105"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M9 13h6M9 17h4" />
                </svg>
                Générer mon CV
              </Link>
              <Link
                href="/jobs"
                className="inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition-colors hover:bg-white/20"
              >
                Parcourir les offres
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

// -----------------------------------------------------------------------------
//  Sous-composants — inline car la page est un Server Component
// -----------------------------------------------------------------------------

function SectionHeading({
  kicker,
  title,
  actionHref,
  actionLabel,
}: {
  kicker: string;
  title: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-4 sm:mb-5">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-brand-accent mb-1">
          {kicker}
        </p>
        <h2 className="text-lg sm:text-2xl font-bold text-black dark:text-white font-[var(--font-display)] leading-tight">
          {title}
        </h2>
      </div>
      {actionHref && actionLabel && (
        <Link
          href={actionHref}
          className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:gap-2 transition-all"
        >
          {actionLabel}
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}

function HomeBlogCard({
  post,
  index,
}: {
  post: { title: string; slug: string; excerpt?: string | null; cover_image?: string | null; author?: string };
  index: number;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors hover:border-primary/30 animate-fade-in-up"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="relative h-24 sm:h-32 overflow-hidden bg-brand-soft dark:bg-slate-800">
        <CoverImage
          src={post.cover_image || IMAGES.blog}
          alt={post.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="font-bold text-[12.5px] sm:text-sm leading-snug text-black dark:text-white line-clamp-2 transition-colors group-hover:text-primary">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-1.5 flex-1 text-[11px] sm:text-xs text-black dark:text-white line-clamp-2 leading-relaxed">
            {post.excerpt}
          </p>
        )}
        <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-primary">
          Lire l'article
          <svg className="h-3 w-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

function HomeStat({
  value,
  suffix,
  label,
  icon,
  href,
}: {
  value: number;
  suffix: string;
  label: string;
  icon: ReactNode;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-3 sm:gap-4 rounded-xl border border-line bg-white dark:border-slate-800 dark:bg-slate-900 p-3.5 sm:p-4 transition-colors hover:border-primary/30 animate-fade-in-up">
      <span className="shrink-0 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <span aria-hidden="true">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-lg sm:text-2xl font-black text-black dark:text-white font-[var(--font-display)] leading-none tabular-nums">
          {value.toLocaleString('fr-FR')}
          {suffix}
        </div>
        <div className="mt-1 text-[11px] sm:text-xs font-medium text-black dark:text-white truncate">
          {label}
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block"
      >
        {content}
      </Link>
    );
  }

  return content;
}

function Stat({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 sm:px-3 py-1.5 rounded-full border border-line dark:border-slate-800 text-black dark:text-white">
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-dashed border-line dark:border-slate-700 rounded-xl p-8 sm:p-12 text-center">
      <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-brand-soft dark:bg-slate-800 flex items-center justify-center mb-5">
        <svg
          className="w-8 h-8 sm:w-10 sm:h-10 text-black dark:text-white"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.7}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </div>
      <h3 className="text-lg sm:text-xl font-bold text-black dark:text-white mb-2 font-[var(--font-display)]">
        Aucune offre publiée pour le moment
      </h3>
      <p className="text-sm sm:text-base text-black dark:text-white mb-6 max-w-md mx-auto">
        Essayez avec un autre mot-clé, une ville voisine, ou supprimez certains filtres.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        Réinitialiser les filtres
      </Link>
    </div>
  );
}

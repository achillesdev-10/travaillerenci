import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import CoverImage from '@/components/content/CoverImage';
import SearchBar from '@/components/jobs/SearchBar';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { ExamService } from '@/services/examService';
import { BlogService } from '@/services/blogService';
import type { JobOfferSchema, JobContractType } from '@/types';
import NewsTicker, { type TickerItem } from '@/components/home/NewsTicker';
import HomeCarousel from '@/components/home/HomeCarousel';
import PollWidget from '@/components/home/PollWidget';
import OffersGrid from '@/components/home/OffersGrid';
import SocialLinks from '@/components/layout/SocialLinks';
import { buildCarouselSlides } from '@/lib/homeCarousel';
import { IMAGES } from '@/lib/images';
import { getSiteUrl } from '@/lib/site';

export const revalidate = 60;

const QUICK_LINKS = [
  {
    label: 'Offres d\u2019emploi',
    desc: 'CDI, CDD, prestation',
    href: '/jobs',
    color: 'bg-orange-500',
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
    color: 'bg-sky-500',
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
    color: 'bg-emerald-600',
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
    color: 'bg-indigo-600',
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
    color: 'bg-purple-600',
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
    color: 'bg-rose-500',
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
const POPULAR_SECTORS = [
  { q: 'développeur', name: 'IT / Digital', image: IMAGES.it },
  { q: 'banque', name: 'Banque / Finance', image: IMAGES.banque },
  { q: 'infirmier', name: 'Santé', image: IMAGES.sante },
  { q: 'enseignant', name: 'Éducation / Formation', image: IMAGES.education },
  { q: 'commercial', name: 'Commerce / Distribution', image: IMAGES.commerce },
  { q: 'chantier', name: 'BTP / Immobilier', image: IMAGES.btp },
  { q: 'ingénieur', name: 'Industrie', image: IMAGES.industrie },
  { q: 'chauffeur', name: 'Transport / Logistique', image: IMAGES.transport },
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

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{
    q?: string;
    city?: string;
    contract?: string;
  }>;
}) {
  const sp = await searchParams;
  const keyword = (sp?.q || '').trim();
  const location = (sp?.city || '').trim();
  const contract = (sp?.contract || '').trim() as JobContractType;

  const [jobs, examRows, blogRows, bourseRows] = await Promise.all([
    JobOfferSchemaService.list({
      keyword: keyword || undefined,
      location: location || undefined,
      contract_type: contract || undefined,
      status: 'published',
      limit: 60,
      order_by: 'created_at',
      order_dir: 'desc',
    }),
    ExamService.list({ status: 'published', limit: 6, order_by: 'created_at', order_dir: 'desc' }),
    BlogService.list({ status: 'published', limit: 4, order_by: 'published_at', order_dir: 'desc' }),
    JobOfferSchemaService.list({
      category: 'scholarship',
      status: 'published',
      limit: 4,
      order_by: 'created_at',
      order_dir: 'desc',
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
    offers: keyword || location || contract ? undefined : (jobsList as JobOfferSchema[]),
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
    <main className="flex-1 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
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
      <section className="relative overflow-hidden bg-primary/5 dark:bg-primary/10 pt-8 pb-8 sm:pt-14 sm:pb-10 border-b border-border/40">
        <div className="container mx-auto px-4 relative z-10 max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            {/* Colonne texte */}
            <div className="text-center lg:text-left animate-fade-in-up">
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-[12px] sm:text-sm font-semibold mb-4 sm:mb-5">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
                Plateforme 100% ivoirienne
              </div>

              <h1 className="text-[28px] leading-[1.15] sm:text-4xl lg:text-[44px] xl:text-5xl font-extrabold mb-3 sm:mb-5 font-[var(--font-display)] text-gray-900 dark:text-white">
                Travailleren<span className="text-primary">Ci</span>
                <span className="block text-gray-800 dark:text-gray-200 text-[22px] sm:text-3xl lg:text-[32px] mt-1 sm:mt-2">
                  Trouvez un job qui <span className="text-primary">vaut le coup</span>
                </span>
              </h1>

              <p className="text-[15px] sm:text-lg text-gray-600 dark:text-gray-300 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Des <strong className="text-gray-900 dark:text-white">offres vérifiées</strong>, des entreprises de confiance,
                et zéro spam. Postulez simplement — on s'occupe du reste.
              </p>
            </div>

            {/* Colonne illustration (desktop uniquement) — vraie photo + badges flottants */}
            <div className="hidden lg:block relative">
              <div className="relative overflow-hidden rounded-3xl shadow-2xl shadow-primary/20 ring-1 ring-black/5 animate-float">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={IMAGES.hero}
                  alt="Jeune professionnel ivoirien en recherche d'emploi"
                  width={520}
                  height={445}
                  className="w-full max-w-[520px] h-[380px] lg:h-[420px] object-cover"
                  fetchPriority="high"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/40 via-transparent to-transparent" aria-hidden="true" />
              </div>

              {/* Badge : offres vérifiées */}
              <div className="absolute -left-5 top-8 flex items-center gap-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3 shadow-lg border border-border animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5" aria-hidden="true">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-extrabold text-gray-900 dark:text-white leading-none">Offres vérifiées</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Zéro spam, que du sérieux</div>
                </div>
              </div>

              {/* Badge : concours & bourses */}
              <div className="absolute -right-3 bottom-10 flex items-center gap-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3 shadow-lg border border-border animate-fade-in-up" style={{ animationDelay: '350ms' }}>
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4.5 w-4.5" aria-hidden="true">
                    <path d="M3 21h18" />
                    <path d="M4 21V10l8-6 8 6v11" />
                    <path d="M9 21v-6h6v6" />
                  </svg>
                </span>
                <div>
                  <div className="text-sm font-extrabold text-gray-900 dark:text-white leading-none">Concours & bourses</div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">ENA, INFAS, universités…</div>
                </div>
              </div>
            </div>
          </div>

          {/* Barre de recherche pleine largeur */}
          <div className="mt-8 sm:mt-10 max-w-4xl mx-auto">
            <Suspense fallback={<SearchBarSkeleton />}>
              <SearchBar
                initialKeyword={keyword}
                initialLocation={location}
                initialContract={contract}
              />
            </Suspense>

            <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-5 text-[12px] sm:text-sm text-gray-500 dark:text-gray-400">
              <Stat
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-emerald-500">
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
      <section className="container mx-auto px-4 -mt-2 sm:mt-2 max-w-6xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <HomeStat
            value={totalKnown}
            suffix="+"
            label="Offres d'emploi"
            color="bg-orange-500"
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
            color="bg-indigo-600"
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
            color="bg-emerald-600"
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
            color="bg-rose-500"
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
              className="group relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* Photo de fond + voile sombre (l'image ne charge pas ? la couleur de repli reste visible) */}
              <div className={`absolute inset-0 ${link.color}`} aria-hidden="true" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={link.image}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-900/30 to-slate-900/10" aria-hidden="true" />
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/15 transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
              <div className="relative flex flex-col gap-1.5">
                <span className="text-2xl sm:text-3xl drop-shadow" aria-hidden="true">
                  {link.icon}
                </span>
                <span className="font-[var(--font-display)] text-sm sm:text-base font-extrabold leading-tight">
                  {link.label}
                </span>
                <span className="text-[11px] sm:text-xs text-white/85 leading-tight">
                  {link.desc}
                </span>
                <span className="mt-1 inline-flex items-center gap-1 text-[11px] sm:text-xs font-bold opacity-0 transition-opacity group-hover:opacity-100">
                  Explorer
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
          {POPULAR_SECTORS.map((sector, i) => (
            <Link
              key={sector.q}
              href={`/jobs?q=${encodeURIComponent(sector.q)}`}
              className="group relative overflow-hidden rounded-2xl aspect-[4/3] shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-in-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={sector.image}
                alt={sector.name}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-900/25 to-transparent" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 bg-white/15 backdrop-blur px-2 py-0.5 rounded-full inline-block mb-1.5">
                  Voir les offres
                </span>
                <div className="font-[var(--font-display)] text-sm sm:text-base font-extrabold text-white leading-tight drop-shadow">
                  {sector.name}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   OFFRE À LA UNE — grille 2 colonnes dès le mobile                        */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 pb-4 sm:pb-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-4 mt-10 sm:mt-14 mb-4 sm:mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white font-[var(--font-display)]">
              {keyword || location || contract
                ? `${totalKnown} résultat${totalKnown > 1 ? 's' : ''}`
                : 'Dernières offres'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {keyword || location || contract
                ? <>Triées par : pertinence + nouveauté</>
                : <>Les dernières opportunités publiées sur TravaillerenCi</>}
            </p>
          </div>
          {(keyword || location || contract) && (
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-1.5 self-start sm:self-auto px-3.5 py-2 text-sm rounded-lg border border-border hover:bg-gray-50 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12h14" />
                <path d="m10 5-7 7 7 7" />
              </svg>
              Réinitialiser
            </Link>
          )}
        </div>

        {jobsList.length === 0 ? (
          <EmptyState keyword={keyword} location={location} contract={contract} />
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {HOW_IT_WORKS.map((step, i) => (
            <div
              key={step.title}
              className="group relative overflow-hidden rounded-3xl border border-border bg-white dark:bg-slate-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-in-up"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <div className="relative h-36 sm:h-40 overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={step.image}
                  alt={step.title}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" aria-hidden="true" />
                <span className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary font-black font-[var(--font-display)] shadow-lg">
                  {i + 1}
                </span>
              </div>
              <div className="p-4 sm:p-5">
                <h3 className="font-[var(--font-display)] text-base sm:text-lg font-extrabold text-gray-900 dark:text-white mb-1.5">
                  {step.title}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{step.desc}</p>
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
            </div>
          ))}
        </div>
      </section>

      {/* ======================================================================== */}
      {/*   SUIVEZ-NOUS — réseaux sociaux du moment                                */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24 max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl bg-slate-900 dark:bg-slate-900 text-white shadow-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={IMAGES.community}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-30"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/70 to-slate-900/40" aria-hidden="true" />
          <div className="relative flex flex-col lg:flex-row items-center gap-6 lg:gap-10 px-6 py-10 sm:p-12">
            <div className="text-center lg:text-left flex-1">
              <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Suivez-nous</p>
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
      {/*   BANDEAU CTA                                                             */}
      {/* ======================================================================== */}
      <section className="container mx-auto px-4 pb-16 sm:pb-24 max-w-6xl">
        <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-10 sm:p-12 text-center text-white shadow-xl shadow-primary/20">
          <div className="relative">
            <h2 className="font-[var(--font-display)] text-2xl sm:text-4xl font-extrabold mb-3">
              Prêt à décrocher votre prochain job ?
            </h2>
            <p className="mx-auto max-w-2xl text-sm sm:text-base text-white/90 mb-6">
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
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-emerald-400 mb-1">
          {kicker}
        </p>
        <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-tight">
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
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:border-primary/25 animate-fade-in-up"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="relative h-24 sm:h-32 overflow-hidden bg-gray-100 dark:bg-slate-800">
        {post.cover_image ? (
          <CoverImage
            src={post.cover_image}
            alt={post.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center opacity-60">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
              <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="font-bold text-[12.5px] sm:text-sm leading-snug text-gray-900 line-clamp-2 transition-colors group-hover:text-primary">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-1.5 flex-1 text-[11px] sm:text-xs text-gray-500 line-clamp-2 leading-relaxed">
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
  color,
  icon,
}: {
  value: number;
  suffix: string;
  label: string;
  color: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4 rounded-2xl border border-border bg-white dark:bg-slate-900 p-3.5 sm:p-5 shadow-sm hover:shadow-md transition-shadow animate-fade-in-up">
      <span className={`shrink-0 flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl ${color} text-white shadow-md`}>
        <span aria-hidden="true">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-lg sm:text-2xl font-black text-gray-900 dark:text-white font-[var(--font-display)] leading-none tabular-nums">
          {value.toLocaleString('fr-FR')}
          {suffix}
        </div>
        <div className="mt-1 text-[11px] sm:text-xs font-medium text-gray-500 dark:text-gray-400 truncate">
          {label}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white/70 dark:bg-slate-900/75 backdrop-blur px-2.5 sm:px-3 py-1.5 rounded-full border border-border shadow-sm text-gray-700 dark:text-gray-300">
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  );
}

function SearchBarSkeleton() {
  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-border rounded-2xl shadow-md shadow-black/5 p-4 sm:p-6 animate-pulse">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-12">
        <div className="md:col-span-6 h-[52px] bg-gray-100 dark:bg-slate-800 rounded-xl" />
        <div className="md:col-span-4 grid grid-cols-2 gap-3">
          <div className="h-[52px] bg-gray-100 dark:bg-slate-800 rounded-xl" />
          <div className="h-[52px] bg-gray-100 dark:bg-slate-800 rounded-xl" />
        </div>
        <div className="md:col-span-2 h-[52px] bg-gray-100 dark:bg-slate-800 rounded-xl" />
      </div>
    </div>
  );
}

function EmptyState({
  keyword,
  location,
  contract,
}: {
  keyword: string;
  location: string;
  contract: string;
}) {
  const label =
    [
      keyword ? `"${keyword}"` : '',
      location ? `à ${location}` : '',
      contract ? `en ${contract}` : '',
    ]
      .filter(Boolean)
      .join(' ') || 'cette zone';

  return (
    <div className="bg-white dark:bg-slate-900 border border-dashed border-border rounded-2xl p-8 sm:p-12 text-center">
      <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-5">
        <svg
          className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 dark:text-gray-500"
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
      <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 font-[var(--font-display)]">
        Aucune offre trouvée pour {label}
      </h3>
      <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
        Essayez avec un autre mot-clé, une ville voisine, ou supprimez certains filtres.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm shadow-md shadow-primary/20"
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

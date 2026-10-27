import Link from 'next/link';
import type { Metadata } from 'next';
import { getCachedJobVivier } from '@/lib/cachedJobVivier';
import CompactJobCard from '@/components/home/CompactJobCard';
import ShareButton from '@/components/ShareButton';
import {
  filterRecentOffers,
  mustSeeReasons,
  pickMustSeeOffers,
} from '@/lib/mustSee';
import {
  CITY_SEO_BY_SLUG,
  METIER_SEO_BY_SLUG,
  eligibleSeoLandings,
} from '@/lib/jobSeo';
import type { JobOfferSchema } from '@/types';
import { getSiteUrl } from '@/lib/site';

export const revalidate = 3600;

const BASE_URL = getSiteUrl();
const PAGE_SIZE = 24;

interface ReasonBadge {
  key: string;
  label: string;
  className: string;
}

const REASON_BADGES: Record<string, ReasonBadge> = {
  populaire: {
    key: 'populaire',
    label: 'Populaire',
    className: 'bg-amber-500 text-white',
  },
  recente: {
    key: 'recente',
    label: 'Nouvelle',
    className: 'bg-primary text-white',
  },
  deadline: {
    key: 'deadline',
    label: 'Clôture bientôt',
    className: 'bg-rose-600 text-white',
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const url = `${BASE_URL}/jobs/today`;
  const title = "Offres du jour en Côte d'Ivoire";
  const description =
    "Les offres d'emploi et de stage publiées aujourd'hui sur TravaillerEnCi : nouveaux recrutements, offres les plus consultées et candidatures bientôt clôturées. Mise à jour quotidienne.";
  const fullTitle = `${title} | TravaillerenCi`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'fr_CI',
      url,
      siteName: 'TravaillerenCi',
      title: fullTitle,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
    },
  };
}

/** Vivier borné partagé avec les autres pages SEO (cache 10 min). */
async function loadVivier(): Promise<JobOfferSchema[]> {
  return getCachedJobVivier('both');
}

export default async function JobsTodayPage() {
  const vivier = await loadVivier();
  const now = new Date();

  // Offres publiées aujourd'hui ; repli sur 48 h si la journée est encore pauvre.
  let todayOffers = filterRecentOffers(vivier, 24, now);
  let windowLabel = 'publiées aujourd’hui';
  if (todayOffers.length < 4) {
    const extended = filterRecentOffers(vivier, 48, now);
    if (extended.length > todayOffers.length) {
      todayOffers = extended;
      windowLabel = 'publiées dans les dernières 48 heures';
    }
  }

  const mustSee = pickMustSeeOffers(vivier, { now, limit: 8 });
  const shownToday = todayOffers.slice(0, PAGE_SIZE);

  // Maillage (§33) : on ne relie que les pages SEO réellement éligibles
  // (assez d'offres publiées) — jamais de lien vers une page vide.
  const cityLinks = new Map<string, { href: string; name: string }>();
  const metierLinks = new Map<string, { href: string; name: string }>();
  for (const landing of eligibleSeoLandings(vivier)) {
    if (landing.citySlug && !landing.metierSlug) {
      const city = CITY_SEO_BY_SLUG[landing.citySlug];
      const existing = cityLinks.get(landing.citySlug);
      if (city && (!existing || landing.activity === 'emplois')) {
        cityLinks.set(landing.citySlug, { href: `/${landing.slug}`, name: city.name });
      }
    }
    if (landing.metierSlug && !landing.citySlug) {
      const metier = METIER_SEO_BY_SLUG[landing.metierSlug];
      const existing = metierLinks.get(landing.metierSlug);
      if (metier && (!existing || landing.activity === 'emplois')) {
        metierLinks.set(landing.metierSlug, { href: `/${landing.slug}`, name: metier.label });
      }
    }
  }

  const todayLabel = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const breadcrumbItems = [
    { name: 'Accueil', url: BASE_URL },
    { name: "Offres d'emploi", url: `${BASE_URL}/jobs` },
    { name: 'Offres du jour', url: `${BASE_URL}/jobs/today` },
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: breadcrumbItems.map((b, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: b.name,
          item: b.url,
        })),
      },
      {
        '@type': 'ItemList',
        name: 'Offres du jour',
        numberOfItems: shownToday.length,
        itemListElement: shownToday.slice(0, 20).map((job, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: job.title,
          url: `${BASE_URL}/jobs/${job.id}`,
        })),
      },
    ],
  };

  return (
    <main className="flex-1 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="container mx-auto px-4 max-w-6xl">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:text-primary">
            Accueil
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <Link href="/jobs" className="hover:text-primary">
            Offres d&apos;emploi
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-200">Offres du jour</span>
        </nav>

        {/* En-tête : partageable pour Facebook / LinkedIn (§34) */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-primary/5 p-6 dark:border-slate-800 dark:bg-primary/10 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="mb-2 font-[var(--font-display)] text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
                Offres du jour
              </h1>
              <p className="text-sm font-semibold capitalize text-primary">{todayLabel}</p>
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-gray-600 dark:text-gray-300">
                Les offres d&apos;emploi et de stage {windowLabel} en Côte d&apos;Ivoire, rassemblées
                au même endroit et mises à jour chaque jour. Partagez cette page pour informer vos
                proches des derniers recrutements.
              </p>
            </div>
            <ShareButton
              title="Offres du jour — TravaillerEnCi"
              text="Découvrez les dernières offres d'emploi et de stage publiées aujourd'hui en Côte d'Ivoire."
              url={`${BASE_URL}/jobs/today`}
              campaign="offres-du-jour"
            />
          </div>
        </div>

        {/* ===== Publiées aujourd'hui ===== */}
        <section aria-labelledby="today-offers" className="mb-12">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
            <h2
              id="today-offers"
              className="font-[var(--font-display)] text-xl font-bold text-gray-900 dark:text-white"
            >
              {todayOffers.length > 0
                ? `${todayOffers.length} ${todayOffers.length > 1 ? 'offres récentes' : 'offre récente'}`
                : 'Aucune offre publiée aujourd’hui'}
            </h2>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
            >
              Toutes les offres
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>

          {shownToday.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {shownToday.map((job) => (
                <CompactJobCard key={job.id} job={job} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Aucune nouvelle offre n&apos;a encore été publiée aujourd&apos;hui. Revenez plus tard
                ou parcourez l&apos;ensemble des offres disponibles.
              </p>
              <Link
                href="/jobs"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
              >
                Voir toutes les offres
              </Link>
            </div>
          )}
        </section>

        {/* ===== À ne pas manquer (§35, critères gratuits) ===== */}
        {mustSee.length > 0 && (
          <section aria-labelledby="must-see" className="mb-12">
            <div className="mb-2">
              <h2
                id="must-see"
                className="font-[var(--font-display)] text-xl font-bold text-gray-900 dark:text-white"
              >
                Offres à ne pas manquer
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sélection du jour : les offres les plus consultées, les plus fraîches et celles dont
                la candidature se termine bientôt.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
              {mustSee.map((job) => {
                const reasons = mustSeeReasons(job, now)
                  .map((reason) => REASON_BADGES[reason])
                  .filter(Boolean)
                  .slice(0, 2);
                return (
                  <div key={job.id} className="relative h-full">
                    {reasons.length > 0 && (
                      <div className="pointer-events-none absolute left-2 top-2 z-10 flex flex-wrap gap-1">
                        {reasons.map((badge) => (
                          <span
                            key={badge.key}
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold shadow-sm ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <CompactJobCard job={job} />
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ===== Maillage interne (§33) ===== */}
        <section className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="mb-4 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
            Explorer les opportunités
          </h2>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Par type
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/jobs"
                  className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                >
                  Toutes les offres
                </Link>
                <Link
                  href="/stages"
                  className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                >
                  Stages
                </Link>
                <Link
                  href="/concours"
                  className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                >
                  Concours
                </Link>
                <Link
                  href="/bourses"
                  className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                >
                  Bourses d&apos;étude
                </Link>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Par ville
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from(cityLinks.values()).slice(0, 6).map((city) => (
                  <Link
                    key={city.href}
                    href={city.href}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Emplois {city.name}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Par métier
              </p>
              <div className="flex flex-wrap gap-2">
                {Array.from(metierLinks.values()).slice(0, 8).map((metier) => (
                  <Link
                    key={metier.href}
                    href={metier.href}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    {metier.name}
                  </Link>
                ))}
                {metierLinks.size === 0 && cityLinks.size === 0 && (
                  <Link
                    href="/jobs"
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Rechercher par métier
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

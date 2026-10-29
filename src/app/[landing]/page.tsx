import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCachedJobVivier } from '@/lib/cachedJobVivier';
import CompactJobCard from '@/components/home/CompactJobCard';
import type { JobOfferSchema } from '@/types';
import { getSiteUrl } from '@/lib/site';
import {
  CITY_SEO,
  CITY_SEO_BY_SLUG,
  METIER_SEO,
  METIER_SEO_BY_SLUG,
  filterOffersForSeo,
  landingChipHref,
  minOffersFor,
  parseJobSeoSlug,
  seoLandingDescription,
  seoLandingIntro,
  seoLandingKeywords,
  seoLandingTitle,
  type ParsedJobSeoSlug,
} from '@/lib/jobSeo';

/**
 * ISR 1 h : la page est 100 % statique (aucune lecture de cookies /
 * searchParams / headers ; la seule donnée est le vivier en Data Cache,
 * déjà partagé avec /jobs/[id]). La fraîcheur reste sous le contrôle
 * de revalidateJobSurfaces() → revalidatePath('/[landing]', 'page') + le
 * tag 24 h du vivier : une publication rafraîchit les landing immédiatement.
 */
export const revalidate = 3600;

const BASE_URL = getSiteUrl();
const PAGE_SIZE = 24;

interface PageProps {
  params: Promise<{ landing: string }>;
}

/** Vivier borné (500) + offres filtrées correspondant au landing (ISR). */
async function listLandingData(
  parsed: ParsedJobSeoSlug,
): Promise<{ vivier: JobOfferSchema[]; offers: JobOfferSchema[] }> {
  const vivier = await getCachedJobVivier(parsed.activity === 'stages' ? 'stages' : 'jobs');
  return { vivier, offers: filterOffersForSeo(vivier, parsed) };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { landing } = await params;
  const parsed = parseJobSeoSlug(landing);
  if (!parsed) {
    return { title: 'Page introuvable', robots: { index: false, follow: false } };
  }

  const title = seoLandingTitle(parsed);
  const description = seoLandingDescription(parsed);
  const url = `${BASE_URL}/${landing}`;
  // Le layout racine applique déjà le suffixe « | travaillerenci ».
  const fullTitle = `${title} | TravaillerenCi`;

  return {
    title,
    description,
    keywords: seoLandingKeywords(parsed),
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

export default async function JobSeoLandingPage({ params }: PageProps) {
  const { landing } = await params;
  const parsed = parseJobSeoSlug(landing);
  if (!parsed) notFound();

  const { vivier, offers } = await listLandingData(parsed);

  // Garde-fou anti-page-pauvre : sous le seuil, la page n'existe pas (404).
  if (offers.length < minOffersFor(parsed)) notFound();

  const title = seoLandingTitle(parsed);
  const city = parsed.citySlug ? CITY_SEO_BY_SLUG[parsed.citySlug] : null;
  const metier = parsed.metierSlug ? METIER_SEO_BY_SLUG[parsed.metierSlug] : null;
  const shown = offers.slice(0, PAGE_SIZE);

  // Lien « voir tout » vers la recherche filtrée complète.
  const jobsQuery = new URLSearchParams();
  if (metier) jobsQuery.set('q', metier.searchKeyword);
  if (city) jobsQuery.set('city', city.name);
  const jobsHref = `${parsed.activity === 'stages' ? '/stages' : '/jobs'}${
    jobsQuery.toString() ? `?${jobsQuery.toString()}` : ''
  }`;

  const breadcrumbItems = [
    { name: 'Accueil', url: BASE_URL },
    { name: parsed.activity === 'stages' ? 'Stages' : "Offres d'emploi", url: `${BASE_URL}/jobs` },
  ];
  if (city) breadcrumbItems.push({ name: city.name, url: `${BASE_URL}/${parsed.activity}-${city.slug}` });
  if (metier)
    breadcrumbItems.push({
      name: metier.label,
      url: `${BASE_URL}/${parsed.activity}-${metier.slug}`,
    });

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
        name: title,
        numberOfItems: offers.length,
        itemListElement: shown.slice(0, 20).map((job, i) => ({
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
        <nav aria-label="Fil d'Ariane" className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-primary">
            Accueil
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <Link href={parsed.activity === 'stages' ? '/stages' : '/jobs'} className="hover:text-primary">
            {parsed.activity === 'stages' ? 'Stages' : "Offres d'emploi"}
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">{title}</span>
        </nav>

        {/* En-tête éditorial unique */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-primary/5 p-6 dark:border-slate-800 dark:bg-primary/10 sm:p-8">
          <h1 className="mb-3 font-[var(--font-display)] text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
            {title}
          </h1>
          {seoLandingIntro(parsed).map((p, i) => (
            <p
              key={i}
              className="mb-3 max-w-3xl text-base leading-relaxed text-gray-600 dark:text-gray-300"
            >
              {p}
            </p>
          ))}
        </div>

        {/* Compteur + lien recherche complète */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[var(--font-display)] text-xl font-bold text-gray-900 dark:text-white">
            {offers.length} {offers.length > 1 ? 'offres disponibles' : 'offre disponible'}
          </h2>
          <Link
            href={jobsHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
          >
            Recherche avancée
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

        <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((job) => (
            <CompactJobCard key={job.id} job={job as JobOfferSchema} />
          ))}
        </div>

        {/* Maillage interne : autres villes / métiers */}
        <section className="mt-12 rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="mb-4 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
            Explorer les autres opportunités
          </h2>

          <div className="space-y-5">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Par ville
              </p>
              <div className="flex flex-wrap gap-2">
                {CITY_SEO.filter((c) => c.slug !== parsed.citySlug).map((c) => (
                  <Link
                    key={c.slug}
                    href={landingChipHref(vivier, {
                      activity: parsed.activity,
                      citySlug: c.slug,
                      metierSlug: null,
                    })}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    {parsed.activity === 'stages' ? 'Stages' : 'Emplois'} {c.name}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                Par métier
              </p>
              <div className="flex flex-wrap gap-2">
                {METIER_SEO.filter((m) => m.slug !== parsed.metierSlug).map((m) => (
                  <Link
                    key={m.slug}
                    href={landingChipHref(vivier, {
                      activity: parsed.activity,
                      citySlug: null,
                      metierSlug: m.slug,
                    })}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    {m.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

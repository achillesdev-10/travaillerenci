import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import SearchBar from '@/components/jobs/SearchBar';
import CompactJobCard from '@/components/home/CompactJobCard';
import type { JobOfferSchema } from '@/types';
import { getSiteUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: "Offres de stage en Côte d'Ivoire — stages en entreprise à Abidjan",
  description:
    "Trouvez votre stage en Côte d'Ivoire : stages en entreprise, alternances et missions de fin d'études à Abidjan et partout dans le pays. Profil recherché, durée, localisation et procédure de candidature sur chaque fiche.",
  alternates: {
    canonical: `${getSiteUrl()}/stages`,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    url: `${getSiteUrl()}/stages`,
    siteName: 'TravaillerenCi',
    title: "Offres de stage en Côte d'Ivoire | TravaillerenCi",
    description:
      "Stages en entreprise, alternances et missions de fin d'études à Abidjan et partout en Côte d'Ivoire : trouvez l'opportunité qui lancera votre carrière.",
  },
  twitter: {
    card: 'summary_large_image',
    title: "Offres de stage en Côte d'Ivoire | TravaillerenCi",
    description:
      "Stages en entreprise, alternances et missions de fin d'études à Abidjan et partout en Côte d'Ivoire.",
  },
};

interface StagesPageProps {
  searchParams: Promise<{
    q?: string;
    city?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 24;

export default async function StagesPage({ searchParams }: StagesPageProps) {
  const resolvedParams = await searchParams;
  const keyword = resolvedParams.q || '';
  const city = resolvedParams.city || '';
  const page = Math.max(1, Number(resolvedParams.page) || 1);

  const { rows: stages, total } = await JobOfferSchemaService.list({
    category: 'internship',
    keyword,
    location: city,
    status: 'published',
    // Les stages expirés (deadline dépassée) ne doivent plus apparaître.
    is_expired: false,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  function filterHref(params: Record<string, string | undefined>) {
    const url = new URLSearchParams();
    const next = { q: keyword, city, ...params };
    Object.entries(next).forEach(([k, v]) => {
      if (v) url.set(k, v);
      else url.delete(k);
    });
    const qs = url.toString();
    return `/stages${qs ? `?${qs}` : ''}`;
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${getSiteUrl()}/` },
      { '@type': 'ListItem', position: 2, name: 'Stages', item: `${getSiteUrl()}/stages` },
    ],
  };

  return (
    <main className="flex-1 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <div className="container mx-auto px-4 max-w-6xl">
        <nav aria-label="Fil d'Ariane" className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-primary">Accueil</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">Offres de stage</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 font-[var(--font-display)] text-gray-900 dark:text-white">
            Offres de stage en Côte d'Ivoire
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg max-w-2xl">
            Stages en entreprise, alternances et missions de fin d&rsquo;études à Abidjan et à
            l&rsquo;intérieur du pays. Retrouvez sur chaque fiche le profil recherché, la durée,
            la localisation et la procédure de candidature.
          </p>
        </div>

        {/* Pills : maillage interne vers les autres catégories */}
        <nav aria-label="Explorer par catégorie" className="mb-6 flex flex-wrap gap-2">
          <Link
            href="/jobs"
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
          >
            Offres d'emploi
          </Link>
          <Link
            href="/concours"
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
          >
            Concours administratifs
          </Link>
          <Link
            href="/bourses"
            className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
          >
            Bourses d'études
          </Link>
        </nav>

        {/* Barre de recherche */}
        <div className="mb-8">
          <Suspense fallback={<SearchBarSkeleton />}>
            <SearchBar initialKeyword={keyword} initialLocation={city} />
          </Suspense>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)]">
            {total} stage{total > 1 ? 's' : ''} disponible{total > 1 ? 's' : ''}
            {keyword || city ? ' (filtrés)' : ''}
          </h2>
        </div>

        {stages.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {stages.map((stage) => (
              <CompactJobCard key={stage.id} job={stage as JobOfferSchema} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-border rounded-2xl p-8 sm:p-12 text-center">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 font-[var(--font-display)]">
              Aucun stage ne correspond à vos critères
            </h3>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Essayez de modifier vos filtres ou consultez les offres d'emploi classiques.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/stages"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm shadow-md transition-all"
              >
                Voir tous les stages
              </Link>
              <Link
                href="/jobs"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 font-semibold text-sm transition-all"
              >
                Offres d'emploi
              </Link>
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && stages.length > 0 && (
          <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
            {safePage > 1 && (
              <Link
                href={filterHref({ page: String(safePage - 1) })}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
              >
                ← Précédent
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<number[]>((acc, p) => {
                if (acc.length && p - acc[acc.length - 1] > 1) acc.push(-1);
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === -1 ? (
                  <span key={`gap-${i}`} className="px-1 text-gray-400">
                    …
                  </span>
                ) : (
                  <Link
                    key={p}
                    href={filterHref({ page: String(p) })}
                    aria-current={p === safePage ? 'page' : undefined}
                    className={cn(
                      'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                      p === safePage
                        ? 'bg-primary text-white shadow-md shadow-primary/20'
                        : 'border border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
                    )}
                  >
                    {p}
                  </Link>
                ),
              )}
            {safePage < totalPages && (
              <Link
                href={filterHref({ page: String(safePage + 1) })}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
              >
                Suivant →
              </Link>
            )}
          </nav>
        )}

        {/* Bloc éditorial — contexte stage */}
        <section className="mt-12 rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
            Comment trouver un stage en Côte d'Ivoire ?
          </h2>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <p>
              Les stages en entreprise sont un tremplin majeur pour l'insertion professionnelle des
              étudiants et jeunes diplômés ivoiriens. Chaque fiche de cette page précise le domaine,
              l'entreprise, la localisation, la durée et le profil attendu — sans jamais inventer
              d'information absente de l'annonce d'origine.
            </p>
            <p>
              Vous cherchez un emploi à temps plein ? Consultez{' '}
              <Link href="/jobs" className="font-semibold text-primary hover:underline">
                les offres d'emploi en Côte d'Ivoire
              </Link>
              ,{' '}
              <Link href="/concours" className="font-semibold text-primary hover:underline">
                les concours administratifs
              </Link>{' '}
              ou{' '}
              <Link href="/bourses" className="font-semibold text-primary hover:underline">
                les bourses d'études
              </Link>
              .
            </p>
          </div>
        </section>
      </div>
    </main>
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

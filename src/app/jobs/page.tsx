import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import SearchBar from '@/components/jobs/SearchBar';
import CompactJobCard from '@/components/home/CompactJobCard';
import type { JobOfferSchema } from '@/types';
import { getSiteUrl } from '@/lib/site';
import { cn } from '@/lib/utils';

export async function generateMetadata({
  searchParams,
}: JobsPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const isStagesView = sp.contract === 'Stage';
  // Vue « stages » de /jobs ?contract=Stage : même contenu que /stages — on
  // pointe le canonical vers la page dédiée pour éviter la duplication.
  const canonicalPath = isStagesView ? '/stages' : '/jobs';
  const title = isStagesView
    ? "Offres de stage en Côte d'Ivoire | TravaillerenCi"
    : "Offres d'emploi en Côte d'Ivoire | TravaillerenCi";
  const description = isStagesView
    ? "Stages en entreprise, alternances et missions de fin d'études à Abidjan et partout en Côte d'Ivoire : profil recherché, durée et procédure de candidature."
    : "Parcourez, filtrez et recherchez les offres d'emploi, CDI, CDD et stages à Abidjan et partout en Côte d'Ivoire : missions, profil recherché, conditions et procédure de candidature.";
  return {
    title,
    description,
    alternates: { canonical: `${getSiteUrl()}${canonicalPath}` },
    openGraph: {
      type: 'website',
      locale: 'fr_CI',
      url: `${getSiteUrl()}${canonicalPath}`,
      siteName: 'TravaillerenCi',
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

interface JobsPageProps {
  searchParams: Promise<{
    q?: string;
    city?: string;
    contract?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 24;

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const resolvedParams = await searchParams;
  const keyword = resolvedParams.q || '';
  const city = resolvedParams.city || '';
  const contract = resolvedParams.contract || '';
  // Pill de sous-catégorie : emplois (défaut) ou stages.
  const category = resolvedParams.contract === 'Stage' ? 'internship' : null;
  const page = Math.max(1, Number(resolvedParams.page) || 1);

  const { rows: jobs, total } = await JobOfferSchemaService.list({
    // Seuls les emplois et stages (dépôt unifié) apparaissent sur /jobs —
    // les bourses (scholarship) et concours (exam) ont leurs propres pages.
    category: category ? ['internship'] : ['job', 'internship'],
    keyword,
    location: city,
    contract_type: contract && contract !== 'Stage' ? (contract as any) : undefined,
    status: 'published',
    // Les offres expirées (deadline dépassée, en attente d'archivage) ne
    // doivent plus être présentées comme des opportunités actives.
    is_expired: false,
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  function filterHref(params: Record<string, string | undefined>) {
    const url = new URLSearchParams();
    const next = { q: keyword, city, contract, ...params };
    Object.entries(next).forEach(([k, v]) => {
      if (v) url.set(k, v);
      else url.delete(k);
    });
    const qs = url.toString();
    return `/jobs${qs ? `?${qs}` : ''}`;
  }

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${getSiteUrl()}/` },
      { '@type': 'ListItem', position: 2, name: "Offres d'emploi", item: `${getSiteUrl()}/jobs` },
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
          <span className="text-gray-900 dark:text-gray-200 font-medium">Offres d'emploi</span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 font-[var(--font-display)] text-gray-900 dark:text-white">
            {category === 'internship'
              ? "Offres de stage en Côte d'Ivoire"
              : "Offres d'emploi en Côte d'Ivoire"}
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg max-w-2xl">
            {category === 'internship'
              ? 'Trouvez le stage qui lancera votre carrière : stages en entreprise, alternances et missions de fin d\u2019études à Abidjan et à l\u2019intérieur du pays.'
              : "Trouvez l'opportunité idéale parmi nos offres vérifiées à Abidjan et à l'intérieur du pays : CDI, CDD, missions et recrutements des entreprises ivoiriennes et internationales."}
          </p>
        </div>

        {/* Pills : sous-catégories + catégories principales (maillage interne) */}
        <nav aria-label="Explorer par catégorie" className="mb-6 flex flex-wrap gap-2">
          <Link
            href={filterHref({ contract: undefined, page: undefined })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all',
              !category
                ? 'border-primary bg-primary text-white shadow-md shadow-primary/20'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
            )}
          >
            Offres d'emploi
          </Link>
          <Link
            href={filterHref({ contract: 'Stage', page: undefined })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-all',
              category === 'internship'
                ? 'border-primary bg-primary text-white shadow-md shadow-primary/20'
                : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
            )}
          >
            Stages
          </Link>
          <span className="mx-1 hidden sm:inline-block w-px self-stretch bg-gray-200 dark:bg-slate-700" aria-hidden="true" />
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

        {/* Barre de recherche interactive avec gestion des paramètres d'URL */}
        <div className="mb-8">
          <Suspense fallback={<SearchBarSkeleton />}>
            <SearchBar
              initialKeyword={keyword}
              initialLocation={city}
              initialContract={contract}
            />
          </Suspense>
        </div>

        {/* Résultats */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)]">
            {total} {total > 1 ? 'offres trouvées' : 'offre trouvée'}
            {keyword || city || contract ? ' (filtrées)' : ''}
          </h2>
        </div>

        {jobs.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {jobs.map((job) => (
              <CompactJobCard key={job.id} job={job as JobOfferSchema} />
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
              Aucune offre ne correspond à vos critères
            </h3>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Essayez de modifier vos filtres, de chercher un autre mot-clé ou de réinitialiser la recherche.
            </p>
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm shadow-md transition-all"
            >
              Voir toutes les offres
            </Link>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && jobs.length > 0 && (
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

        {/* Bloc éditorial — contexte + confiance */}
        <section className="mt-12 rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
            Pourquoi chercher un emploi sur TravaillerEnCi ?
          </h2>
          <div className="max-w-3xl space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            <p>
              Chaque offre est collectée auprès des sites de recrutement actifs en Côte d'Ivoire,
              relue puis publiée avec ses informations essentielles : intitulé exact du poste,
              entreprise, localisation, type de contrat, missions, profil recherché et procédure
              de candidature. La fiche d'une offre renvoie toujours vers l'annonce originale pour
              que vous puissiez vérifier l'information.
            </p>
            <p>
              Vous cherchez un stage ? Consultez{' '}
              <Link href="/stages" className="font-semibold text-primary hover:underline">
                toutes les offres de stage
              </Link>
              . Pour les recrutements de la fonction publique, direction{' '}
              <Link href="/concours" className="font-semibold text-primary hover:underline">
                les concours administratifs
              </Link>
              , et pour financer vos études,{' '}
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

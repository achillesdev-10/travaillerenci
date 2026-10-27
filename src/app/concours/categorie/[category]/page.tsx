import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCachedExams } from '@/lib/cachedContent';
import CategoryIcon from '@/components/exams/CategoryIcon';
import PhaseSection, { groupExamsByPhase, SECTION_LIMIT } from '@/components/exams/PhaseSection';
import { getSiteUrl } from '@/lib/site';
import { CATEGORY_SEO } from '@/lib/examSeo';
import { EXAM_CATEGORIES, EXAM_CATEGORY_LABEL } from '@/lib/examConstants';
import type { ExamCategory } from '@/types/exam';

export const revalidate = 300;

const BASE_URL = getSiteUrl();

interface PageProps {
  params: Promise<{ category: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { category } = await params;
  const seo = CATEGORY_SEO[category as ExamCategory];
  if (!seo) {
    return { title: 'Catégorie introuvable', robots: { index: false, follow: false } };
  }
  const url = `${BASE_URL}/concours/categorie/${category}`;
  return {
    title: `${seo.metaTitle} | TravaillerenCi`,
    description: seo.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'fr_CI',
      url,
      siteName: 'TravaillerenCi',
      title: `${seo.metaTitle} | TravaillerenCi`,
      description: seo.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${seo.metaTitle} | TravaillerenCi`,
      description: seo.description,
    },
  };
}

export default async function ConcoursCategoryPage({ params }: PageProps) {
  const { category } = await params;
  const seo = CATEGORY_SEO[category as ExamCategory];
  if (!seo) notFound();

  const { rows: exams, total } = await getCachedExams({
    category: seo.category,
    status: 'published',
    limit: 200,
    order_by: 'created_at',
    order_dir: 'desc',
    fields: 'card',
  });

  // Regroupement « métier » : en cours / à venir / clos & résultats.
  const grouped = groupExamsByPhase(exams);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Concours', item: `${BASE_URL}/concours` },
          {
            '@type': 'ListItem',
            position: 3,
            name: seo.title,
            item: `${BASE_URL}/concours/categorie/${category}`,
          },
        ],
      },
      {
        '@type': 'ItemList',
        name: seo.title,
        numberOfItems: exams.length,
        itemListElement: exams.slice(0, 20).map((exam, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          name: exam.title,
          url: `${BASE_URL}/concours/${exam.slug || exam.id}`,
        })),
      },
    ],
  };

  return (
    <main className="flex-1 min-h-screen bg-gray-50 py-8 transition-colors dark:bg-slate-950 sm:py-12">
      <div className="container mx-auto max-w-6xl px-4">
        <nav aria-label="Fil d'Ariane" className="mb-6 text-sm text-gray-500 dark:text-gray-400">
          <Link href="/" className="hover:text-primary">
            Accueil
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <Link href="/concours" className="hover:text-primary">
            Concours
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-200">{seo.title}</span>
        </nav>

        {/* En-tête éditorial unique */}
        <div className="mb-8 rounded-2xl border border-gray-100 bg-primary/5 p-6 dark:border-slate-800 dark:bg-primary/10 sm:p-8">
          <h1 className="mb-3 font-[var(--font-display)] text-3xl font-extrabold text-gray-900 dark:text-white sm:text-4xl">
            {seo.title}
          </h1>
          {seo.intro.map((p, i) => (
            <p key={i} className="mb-3 max-w-3xl text-base leading-relaxed text-gray-600 dark:text-gray-300">
              {p}
            </p>
          ))}
          <div className="mt-4 flex flex-wrap gap-2">
            {seo.examples.map((e) => (
              <span
                key={e}
                className="rounded-full border border-gray-200 bg-white/80 px-3 py-1 text-xs font-semibold text-gray-600 dark:border-slate-700 dark:bg-slate-800/80 dark:text-gray-300"
              >
                {e}
              </span>
            ))}
          </div>
        </div>

        {/* Compteur */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-[var(--font-display)] text-xl font-bold text-gray-900 dark:text-white">
            {total} concours {EXAM_CATEGORY_LABEL[category as ExamCategory].toLowerCase()}
            {total > 1 ? 's' : ''} recensé{total > 1 ? 's' : ''}
          </h2>
          <Link
            href="/concours"
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
          >
            Tous les concours
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </Link>
        </div>

        {/* Résultats — regroupés par phase (en cours / à venir / archives) */}
        {exams.length > 0 ? (
          <>
            <PhaseSection
              title="Concours en cours"
              subtitle="Inscriptions ouvertes ou épreuves en cours"
              accent="emerald"
              exams={grouped.current}
              limit={SECTION_LIMIT}
              viewAllHref={`/concours?category=${category}&phase=current`}
              viewAllLabel="Voir tout"
            />
            <PhaseSection
              title="Concours à venir"
              subtitle="Annoncés — inscriptions pas encore ouvertes"
              accent="indigo"
              exams={grouped.upcoming}
              limit={SECTION_LIMIT}
              viewAllHref={`/concours?category=${category}&phase=upcoming`}
              viewAllLabel="Voir tout"
            />
            <PhaseSection
              title="Concours clos & résultats"
              subtitle="Archives des sessions passées"
              accent="slate"
              exams={grouped.past}
              limit={SECTION_LIMIT}
              viewAllHref={`/concours?category=${category}&phase=past`}
              viewAllLabel="Voir tout"
            />
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-12">
            <h3 className="mb-2 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
              Aucun concours publié dans cette catégorie pour le moment
            </h3>
            <p className="mx-auto mb-6 max-w-md text-sm text-gray-500 dark:text-gray-400 sm:text-base">
              Les nouveaux avis apparaissent ici dès leur validation. Consultez les autres
              catégories ci-dessous.
            </p>
          </div>
        )}

        {/* Maillage interne : autres catégories */}
        <section className="mt-12 rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="mb-4 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
            Explorer les autres catégories de concours
          </h2>
          <div className="flex flex-wrap gap-2">
            {EXAM_CATEGORIES.filter((c) => c.value !== category).map((c) => (
              <Link
                key={c.value}
                href={`/concours/categorie/${c.value}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
              >
                <CategoryIcon category={c.value} className="h-3.5 w-3.5" />
                {c.label}
              </Link>
            ))}
            <Link
              href="/concours"
              className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1.5 text-[12.5px] font-bold text-primary transition-colors hover:bg-primary/15"
            >
              Tous les concours
            </Link>
          </div>
        </section>
      </div>

      {/* JSON-LD (SEO) */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
    </main>
  );
}

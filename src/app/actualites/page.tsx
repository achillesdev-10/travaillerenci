import Link from 'next/link';
import type { Metadata } from 'next';
import { ArticleService } from '@/services/articleService';
import CoverImage from '@/components/content/CoverImage';
import type { Article, ArticleCategory } from '@/types/article';
import { formatDateShort, formatRelativeTime, truncate } from '@/lib/utils';
import { getSiteUrl } from '@/lib/site';
import { IMAGES } from '@/lib/images';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Actualités emploi & formation en Côte d\'Ivoire',
  description:
    'Restez informé des dernières actualités emploi, formation et concours en Côte d\'Ivoire : guides de préparation, conseils carrière et alerts du marché du travail.',
  keywords: [
    'actualités emploi',
    'formation côte d\'ivoire',
    'marché du travail',
    'conseils carrière',
    'guides concours',
    'emploi abidjan',
  ],
  alternates: {
    canonical: `${getSiteUrl()}/actualites`,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    url: `${getSiteUrl()}/actualites`,
    siteName: 'TravaillerenCi',
    title: 'Actualités emploi & formation | TravaillerEnCi',
    description:
      'Guides, conseils et actualités du marché du travail ivoirien.',
  },
};

const CATEGORY_LABELS: Record<ArticleCategory, string> = {
  emploi: 'Emploi',
  formation: 'Formation',
  concours: 'Concours',
  economie: 'Économie',
  carriere: 'Carrière',
  guide: 'Guide',
};

const CATEGORY_COLORS: Record<ArticleCategory, string> = {
  emploi: 'bg-primary/10 text-primary dark:text-emerald-400',
  formation: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  concours: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  economie: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  carriere: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  guide: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

const FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Toutes les catégories' },
  { value: 'emploi', label: 'Emploi' },
  { value: 'formation', label: 'Formation' },
  { value: 'concours', label: 'Concours' },
  { value: 'economie', label: 'Économie' },
  { value: 'carriere', label: 'Carrière' },
  { value: 'guide', label: 'Guides' },
];

interface ActualitesPageProps {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function ActualitesPage({ searchParams }: ActualitesPageProps) {
  const sp = await searchParams;
  const keyword = sp.q || '';
  const category = sp.category || '';
  const page = Math.max(1, Number(sp.page) || 1);

  const PAGE_SIZE = 12;

  const { rows: articles, total } = await ArticleService.list({
    keyword,
    category: category ? (category as ArticleCategory) : undefined,
    status: 'published',
    order_by: 'published_at',
    order_dir: 'desc',
    limit: 500,
  });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = articles.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Featured article = first one
  const featured = paged[0] || null;
  const rest = featured ? paged.slice(1) : paged;

  function filterHref(params: Record<string, string | undefined>) {
    const url = new URLSearchParams();
    const next = { q: keyword, category, ...params };
    Object.entries(next).forEach(([k, v]) => {
      if (v) url.set(k, v);
      else url.delete(k);
    });
    const qs = url.toString();
    return `/actualites${qs ? `?${qs}` : ''}`;
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* ===== En-tête ===== */}
      <section className="relative overflow-hidden border-b border-border/40 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto px-4 py-12 sm:py-16 relative z-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
              <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
            </svg>
            Actualités &amp; Guides
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-[var(--font-display)] text-gray-900 dark:text-white">
            Le marché du travail ivoirien
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Actualités, guides de préparation et conseils pour réussir votre
            carrière en Côte d&apos;Ivoire.
          </p>
        </div>
      </section>

      {/* ===== Filtres ===== */}
      <section className="container mx-auto px-4 pt-8 pb-4 max-w-5xl">
        <form role="search" className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <label htmlFor="news-search" className="sr-only">
              Rechercher une actualité
            </label>
            <span className="pointer-events-none flex items-center justify-center pl-3 text-gray-400 absolute inset-y-0 left-0">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              id="news-search"
              name="q"
              type="search"
              defaultValue={keyword}
              placeholder="Rechercher un article..."
              className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200"
            />
          </div>
          <div className="relative">
            <label htmlFor="news-category" className="sr-only">
              Catégorie
            </label>
            <select
              id="news-category"
              name="category"
              defaultValue={category}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-4 pr-9 text-[13px] font-semibold text-gray-700 outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/10 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-200 sm:w-56"
            >
              {FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </div>
        </form>
      </section>

      {/* ===== Liste des articles ===== */}
      <section className="container mx-auto px-4 pb-12 sm:pb-16 max-w-5xl">
        {paged.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-border rounded-2xl p-10 sm:p-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-gray-400">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)]">
              Aucune actualité pour le moment
            </h2>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
              Revenez bientôt : nos articles sur l&apos;emploi arrivent très vite !
            </p>
            <Link
              href="/concours"
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-md shadow-primary/20 hover:brightness-110 transition-all"
            >
              Voir les concours
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              <strong className="text-gray-800 dark:text-gray-200">{total}</strong>{' '}
              article{total > 1 ? 's' : ''} publié{total > 1 ? 's' : ''}
            </p>

            {/* Featured article */}
            {featured && (
              <Link
                href={`/actualites/${featured.slug}`}
                className="group block mb-8 bg-white dark:bg-slate-900 border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-200"
              >
                <div className="grid sm:grid-cols-2">
                  <div className="relative h-48 sm:h-full overflow-hidden bg-gray-100 dark:bg-slate-800">
                    <CoverImage
                      src={featured.cover_image || IMAGES.blog}
                      alt={featured.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-primary text-white px-2.5 py-1 text-[11px] font-bold shadow-sm">
                      ★ À la une
                    </span>
                  </div>
                  <div className="p-5 sm:p-8 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${CATEGORY_COLORS[featured.category]}`}>
                        {CATEGORY_LABELS[featured.category]}
                      </span>
                      <span className="text-[11px] text-gray-400">
                        {formatRelativeTime(featured.published_at || featured.created_at)}
                      </span>
                    </div>
                    <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-snug group-hover:text-primary transition-colors mb-2">
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3">
                        {featured.excerpt}
                      </p>
                    )}
                    <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      Lire l&apos;article
                      <svg className="w-4 h-4 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {/* Article grid */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {rest.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
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
                      <span key={`gap-${i}`} className="px-1 text-gray-400">…</span>
                    ) : (
                      <Link
                        key={p}
                        href={filterHref({ page: String(p) })}
                        aria-current={p === safePage ? 'page' : undefined}
                        className={`rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                          p === safePage
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'border border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300'
                        }`}
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
          </>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
//  Sous-composants
// ---------------------------------------------------------------------------

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/actualites/${article.slug}`}
      className="group flex flex-col bg-white dark:bg-slate-900 border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-200"
    >
      <div className="relative h-28 overflow-hidden bg-gray-100 dark:bg-slate-800 sm:h-36">
        <CoverImage
          src={article.cover_image || IMAGES.blog}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className={`absolute top-2.5 left-2.5 inline-flex items-center rounded-full bg-white/90 dark:bg-slate-950/80 backdrop-blur px-2 py-0.5 text-[10.5px] font-bold shadow-sm ${CATEGORY_COLORS[article.category]}`}>
          {CATEGORY_LABELS[article.category]}
        </span>
      </div>
      <div className="flex flex-col flex-1 p-3.5 sm:p-5">
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-2">
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span className="hidden sm:inline">
            {article.published_at
              ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(article.published_at))
              : ''}
          </span>
          <span className="sm:hidden">
            {article.published_at ? formatDateShort(article.published_at) : ''}
          </span>
          <span aria-hidden="true">•</span>
          <span className="truncate">{article.author}</span>
        </div>
        <h2 className="text-[13px] sm:text-base font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {article.title}
        </h2>
        {article.excerpt && (
          <p className="mt-1.5 text-[11.5px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 flex-1">
            {truncate(article.excerpt, 150)}
          </p>
        )}
        <div className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] sm:text-sm font-semibold text-primary">
          Lire l&apos;article
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

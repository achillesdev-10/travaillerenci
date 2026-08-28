import Link from 'next/link';
import { EntreprendreArticleService } from '@/services/entreprendreService';
import CoverImage from '@/components/content/CoverImage';
import { getSiteUrl } from '@/lib/site';
import { IMAGES } from '@/lib/images';
import type {
  EntreprendreArticle,
  EntreprendreSector,
  BudgetRange,
} from '@/types/entreprendre';
import EntreprendreFilters from '@/components/entreprendre/EntreprendreFilters';

// ISR : revalidation toutes les heures (articles statiques, données fraîches)
export const revalidate = 3600;

export const metadata = {
  title: 'Entreprendre — Guides business en Côte d\'Ivoire | TravaillerenCi',
  description:
    'Guides pratiques pour lancer votre activité en Côte d\'Ivoire : coiffure, restauration, commerce, digital… Conseils, budgets et étapes pour réussir votre projet.',
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    url: `${getSiteUrl()}/entreprendre`,
    siteName: 'TravaillerenCi',
    title: 'Entreprendre — Guides business | TravaillerenCi',
    description:
      'Guides pratiques pour lancer votre activité en Côte d\'Ivoire. Conseils, budgets et étapes pour réussir.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Entreprendre — Guides business | TravaillerenCi',
    description:
      'Guides pratiques pour lancer votre activité en Côte d\'Ivoire. Conseils, budgets et étapes pour réussir.',
  },
};

/** Libellés français des secteurs. */
const SECTOR_LABELS: Record<EntreprendreSector, string> = {
  restauration: 'Restauration',
  'coiffure-beaute': 'Coiffure & Beauté',
  'commerce-grossiste': 'Commerce de gros',
  'commerce-detail': 'Commerce de détail',
  agroalimentaire: 'Agroalimentaire',
  'it-digital': 'IT / Digital',
  'transport-logistique': 'Transport & Logistique',
  'btp-immobilier': 'BTP & Immobilier',
  sante: 'Santé',
  'education-formation': 'Éducation & Formation',
  'tourisme-hotellerie': 'Tourisme & Hôtellerie',
  artisanat: 'Artisanat',
  'services-professionnels': 'Services professionnels',
  agriculture: 'Agriculture',
  autre: 'Autre',
};

/** Libellés français des budgets. */
const BUDGET_LABELS: Record<BudgetRange, string> = {
  petit: 'Petit budget (< 500 000 FCFA)',
  moyen: 'Budget moyen (500K – 2M FCFA)',
  gros: 'Gros investissement (> 2M FCFA)',
};

function formatDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

export default async function EntreprendrePage({
  searchParams,
}: {
  searchParams: Promise<{ sector?: string; budget?: string; page?: string }>;
}) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page || '1', 10) || 1);
  const limit = 12;
  const offset = (currentPage - 1) * limit;

  const filters: Parameters<typeof EntreprendreArticleService.list>[0] = {
    status: 'published',
    order_by: 'published_at',
    order_dir: 'desc',
    limit,
    offset,
  };

  if (params.sector) {
    filters.sector = params.sector as EntreprendreSector;
  }
  if (params.budget) {
    filters.budget_range = params.budget as BudgetRange;
  }

  const { rows: articles, total } = await EntreprendreArticleService.list(filters);

  // Articles à la une (pas de filtre, top 3)
  const { rows: featuredArticles } = await EntreprendreArticleService.list({
    status: 'published',
    featured: true,
    order_by: 'published_at',
    order_dir: 'desc',
    limit: 3,
  });

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden border-b border-border/40 bg-gradient-to-br from-emerald-50 via-white to-orange-50 dark:from-emerald-950/30 dark:via-slate-950 dark:to-orange-950/20">
        <div className="container mx-auto px-4 py-12 sm:py-16 relative z-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Guides business
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-[var(--font-display)] text-gray-900 dark:text-white">
            Entreprendre en Côte d&apos;Ivoire
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Guides pratiques pour lancer et développer votre activité.
            Coiffure, restauration, commerce, digital… Trouvez l&apos;inspiration
            et les clés pour réussir votre projet.
          </p>
        </div>
      </section>

      {/* ===== Filtres ===== */}
      <section className="container mx-auto px-4 -mt-6 relative z-10 max-w-5xl">
        <EntreprendreFilters
          sectors={SECTOR_LABELS}
          budgets={BUDGET_LABELS}
          currentSector={params.sector}
          currentBudget={params.budget}
        />
      </section>

      {/* ===== Articles à la une ===== */}
      {featuredArticles.length > 0 && !params.sector && !params.budget && (
        <section className="container mx-auto px-4 pt-10 sm:pt-14 max-w-5xl">
          <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)] mb-5">
            ⭐ Articles à la une
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {featuredArticles.map((article) => (
              <FeaturedArticleCard key={article.id} article={article} sectorLabels={SECTOR_LABELS} />
            ))}
          </div>
        </section>
      )}

      {/* ===== Liste des articles ===== */}
      <section className="container mx-auto px-4 py-10 sm:py-14 max-w-5xl">
        {articles.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-border rounded-2xl p-10 sm:p-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-5">
              <span className="text-3xl">📋</span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)]">
              Aucun article trouvé
            </h2>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
              {params.sector || params.budget
                ? 'Essayez de modifier vos filtres pour voir plus de résultats.'
                : 'Revenez bientôt : nos premiers guides arrivent très vite !'}
            </p>
            {(params.sector || params.budget) && (
              <Link
                href="/entreprendre"
                className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-md shadow-primary/20 hover:brightness-110 transition-all"
              >
                Voir tous les articles
              </Link>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              <strong className="text-gray-800 dark:text-gray-200">{total}</strong>{' '}
              article{total > 1 ? 's' : ''} publié{total > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} sectorLabels={SECTOR_LABELS} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
                {currentPage > 1 && (
                  <Link
                    href={`/entreprendre?${new URLSearchParams({
                      ...(params.sector ? { sector: params.sector } : {}),
                      ...(params.budget ? { budget: params.budget } : {}),
                      page: String(currentPage - 1),
                    }).toString()}`}
                    className="px-4 py-2 rounded-xl border border-border bg-white dark:bg-slate-900 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    ← Précédent
                  </Link>
                )}
                <span className="px-4 py-2 text-sm font-semibold text-gray-500 dark:text-gray-400">
                  Page {currentPage} / {totalPages}
                </span>
                {currentPage < totalPages && (
                  <Link
                    href={`/entreprendre?${new URLSearchParams({
                      ...(params.sector ? { sector: params.sector } : {}),
                      ...(params.budget ? { budget: params.budget } : {}),
                      page: String(currentPage + 1),
                    }).toString()}`}
                    className="px-4 py-2 rounded-xl border border-border bg-white dark:bg-slate-900 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors"
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
//  Composants cartes
// ---------------------------------------------------------------------------

function FeaturedArticleCard({
  article,
  sectorLabels,
}: {
  article: EntreprendreArticle;
  sectorLabels: Record<EntreprendreSector, string>;
}) {
  const sector = (article.sector as EntreprendreSector) || 'autre';
  return (
    <Link
      href={`/entreprendre/${article.slug}`}
      className="group flex flex-col bg-white dark:bg-slate-900 border-2 border-amber-200 dark:border-amber-800/50 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
    >
      <div className="relative h-28 overflow-hidden bg-gray-100 dark:bg-slate-800 sm:h-40">
        <CoverImage
          src={article.cover_image || IMAGES.blog}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-amber-400 text-amber-900 px-2.5 py-1 text-[11px] font-bold shadow-sm">
          ⭐ À la une
        </span>
        <span className="absolute top-3 right-3 inline-flex items-center rounded-full bg-white/90 dark:bg-slate-950/80 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shadow-sm">
          {sectorLabels[sector] || sector}
        </span>
      </div>
      <div className="flex flex-col flex-1 p-3.5 sm:p-5">
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-2">
          <span>⏱ {article.reading_time} min de lecture</span>
          <span aria-hidden="true">•</span>
          <span>{formatDate(article.published_at)}</span>
        </div>
        <h2 className="text-[13px] sm:text-lg font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {article.title}
        </h2>
        {article.excerpt && (
          <p className="mt-1.5 sm:mt-2 text-[11.5px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 flex-1">
            {article.excerpt}
          </p>
        )}
        <div className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 text-[11.5px] sm:text-sm font-semibold text-primary">
          Lire le guide
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function ArticleCard({
  article,
  sectorLabels,
}: {
  article: EntreprendreArticle;
  sectorLabels: Record<EntreprendreSector, string>;
}) {
  const sector = (article.sector as EntreprendreSector) || 'autre';
  return (
    <Link
      href={`/entreprendre/${article.slug}`}
      className="group flex flex-col bg-white dark:bg-slate-900 border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-200"
    >
      <div className="relative h-28 overflow-hidden bg-gray-100 dark:bg-slate-800 sm:h-40">
        <CoverImage
          src={article.cover_image || IMAGES.blog}
          alt={article.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-white/90 dark:bg-slate-950/80 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 shadow-sm">
          {sectorLabels[sector] || sector}
        </span>
      </div>
      <div className="flex flex-col flex-1 p-3.5 sm:p-5">
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-2">
          <span>⏱ {article.reading_time} min</span>
          <span aria-hidden="true">•</span>
          <span className="hidden sm:inline">{formatDate(article.published_at)}</span>
          <span aria-hidden="true">•</span>
          <span>{article.view_count} vues</span>
        </div>
        <h2 className="text-[13px] sm:text-lg font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {article.title}
        </h2>
        {article.excerpt && (
          <p className="mt-1.5 sm:mt-2 text-[11.5px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 flex-1">
            {article.excerpt}
          </p>
        )}
        <div className="mt-3 sm:mt-4 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] sm:text-sm font-semibold text-primary">
            Lire le guide
            <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
          {article.helpful_count > 0 && (
            <span className="text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500">
              👍 {article.helpful_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

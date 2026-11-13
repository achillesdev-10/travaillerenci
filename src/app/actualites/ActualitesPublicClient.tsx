'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import CoverImage from '@/components/content/CoverImage';
import { IMAGES } from '@/lib/images';
import { formatDateShort, formatRelativeTime } from '@/lib/utils';
import type { Article, ArticleCategory } from '@/types/article';
import { NEWS_CATEGORY_LABELS, NEWS_CATEGORIES } from '@/lib/news/categories';

const PAGE_SIZE = 12;

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function categoryLabel(category: ArticleCategory): string {
  return NEWS_CATEGORY_LABELS[category] ?? 'Actualité';
}

function CategoryBadge({ category }: { category: ArticleCategory }) {
  return (
    <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-orange-700">
      {categoryLabel(category)}
    </span>
  );
}

function ArticleMeta({ article }: { article: Article }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
      <span>{formatRelativeTime(article.published_at || article.created_at)}</span>
      <span aria-hidden="true">•</span>
      <span className="truncate">{article.author}</span>
      {typeof article.view_count === 'number' && article.view_count > 0 && (
        <>
          <span aria-hidden="true">•</span>
          <span>{article.view_count} vues</span>
        </>
      )}
    </div>
  );
}

function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/actualites/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-lg hover:shadow-orange-100/60"
    >
      <div className="relative h-36 overflow-hidden bg-slate-100 sm:h-44">
        <CoverImage
          src={article.cover_image || IMAGES.blog}
          alt={article.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <span className="absolute left-2.5 top-2.5">
          <CategoryBadge category={article.category} />
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <ArticleMeta article={article} />
        <h3 className="mt-2 line-clamp-2 font-[var(--font-display)] text-[15px] font-bold leading-snug text-slate-900 group-hover:text-orange-600 sm:text-base">
          {article.title}
        </h3>
        {article.excerpt && (
          <p className="mt-1.5 line-clamp-2 flex-1 text-[12.5px] leading-relaxed text-slate-600 sm:text-sm">
            {article.excerpt}
          </p>
        )}
        <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-orange-600">
          Lire l&apos;article
          <svg
            className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export default function ActualitesPublicClient({
  articles,
  mostViewed,
}: {
  articles: Article[];
  mostViewed: Article[];
}) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState<ArticleCategory | 'all'>('all');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const search = normalize(keyword.trim());
    return articles.filter((article) => {
      if (category !== 'all' && article.category !== category) return false;
      if (!search) return true;
      return normalize(`${article.title} ${article.excerpt}`).includes(search);
    });
  }, [articles, category, keyword]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const featured = filtered[0] ?? null;
  const highlights = filtered.slice(1, 5);
  const latest = paged;
  const ticker = articles.slice(0, 8);

  const resetPage = (updater: () => void) => {
    updater();
    setPage(1);
  };

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Bandeau défilant */}
      <div className="border-b border-orange-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2">
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-orange-500 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">
            <span className="h-1.5 w-1.5 animate-ticker-pulse rounded-full bg-white" />
            En direct
          </span>
          <div className="relative flex-1 overflow-hidden">
            <div className="animate-marquee flex w-max items-center gap-8 whitespace-nowrap text-[12.5px] text-slate-600">
              {[...ticker, ...ticker].map((article, index) => (
                <Link
                  key={`${article.id}-${index}`}
                  href={`/actualites/${article.slug}`}
                  className="hover:text-orange-600"
                >
                  {article.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* En-tête éditorial */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600">
                TravaillerEnCi · Actualités
              </p>
              <h1 className="mt-2 font-[var(--font-display)] text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                L&apos;actualité qui éclaire votre carrière
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Emploi, formation, économie et opportunités en Côte d&apos;Ivoire
                et en Afrique — vérifié, hiérarchisé et mis à jour en continu.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center sm:text-right">
              <div>
                <div className="text-2xl font-extrabold text-orange-600">{articles.length}</div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Articles</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-orange-600">
                  {new Set(articles.map((article) => article.category)).size}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Rubriques</div>
              </div>
              <div>
                <div className="text-2xl font-extrabold text-orange-600">
                  {articles[0] ? formatDateShort(articles[0].published_at || articles[0].created_at) : '—'}
                </div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500">Dernière MAJ</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Recherche + filtres */}
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
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
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="search"
              value={keyword}
              onChange={(event) => resetPage(() => setKeyword(event.target.value))}
              placeholder="Rechercher une actualité..."
              aria-label="Rechercher une actualité"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => resetPage(() => setCategory('all'))}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                category === 'all'
                  ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-600'
              }`}
            >
              Tout
            </button>
            {NEWS_CATEGORIES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => resetPage(() => setCategory(item.value))}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition ${
                  category === item.value
                    ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                    : 'border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center sm:p-16">
            <h2 className="font-[var(--font-display)] text-lg font-bold text-slate-900">
              Aucune actualité trouvée
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Essayez un autre mot-clé ou une autre rubrique.
            </p>
            <button
              type="button"
              onClick={() => resetPage(() => { setKeyword(''); setCategory('all'); })}
              className="mt-5 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-orange-600"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <>
            {/* Une + carrousel */}
            <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_1fr]">
              {featured && (
                <Link
                  href={`/actualites/${featured.slug}`}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm"
                >
                  <div className="relative h-64 w-full sm:h-80 lg:h-full lg:min-h-[380px]">
                    <CoverImage
                      src={featured.cover_image || IMAGES.blog}
                      alt={featured.title}
                      className="h-full w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent" />
                    <div className="absolute left-4 top-4">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500 px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide text-white">
                        ★ À la une
                      </span>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                      <CategoryBadge category={featured.category} />
                      <h2 className="mt-2 line-clamp-3 font-[var(--font-display)] text-xl font-extrabold leading-tight text-white sm:text-2xl lg:text-3xl">
                        {featured.title}
                      </h2>
                      {featured.excerpt && (
                        <p className="mt-2 line-clamp-2 max-w-2xl text-[13px] leading-relaxed text-slate-200 sm:text-sm">
                          {featured.excerpt}
                        </p>
                      )}
                      <p className="mt-3 text-[11px] text-slate-300">
                        {formatRelativeTime(featured.published_at || featured.created_at)} ·{' '}
                        {featured.author}
                      </p>
                    </div>
                  </div>
                </Link>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="font-[var(--font-display)] text-sm font-bold uppercase tracking-wide text-slate-900">
                    À ne pas manquer
                  </h2>
                  <span className="text-[11px] text-slate-500">Sélection</span>
                </div>
                <div className="flex snap-x gap-3 overflow-x-auto pb-2">
                  {highlights.map((article) => (
                    <Link
                      key={article.id}
                      href={`/actualites/${article.slug}`}
                      className="group w-[210px] shrink-0 snap-start overflow-hidden rounded-xl border border-slate-100"
                    >
                      <div className="relative h-24 overflow-hidden bg-slate-100">
                        <CoverImage
                          src={article.cover_image || IMAGES.blog}
                          alt={article.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                      <div className="p-3">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600">
                          {categoryLabel(article.category)}
                        </span>
                        <h3 className="mt-1 line-clamp-2 text-[12.5px] font-semibold leading-snug text-slate-900 group-hover:text-orange-600">
                          {article.title}
                        </h3>
                        <p className="mt-1 text-[10.5px] text-slate-500">
                          {formatRelativeTime(article.published_at || article.created_at)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* Dernières actualités + les plus lues */}
            <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_300px]">
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-[var(--font-display)] text-lg font-bold text-slate-900">
                    Dernières actualités
                  </h2>
                  <span className="text-[11.5px] text-slate-500">
                    {filtered.length} article{filtered.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {latest.map((article) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <nav
                    aria-label="Pagination"
                    className="mt-8 flex flex-wrap items-center justify-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={() => setPage(Math.max(1, safePage - 1))}
                      disabled={safePage === 1}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      ← Précédent
                    </button>
                    {Array.from({ length: totalPages }, (_, index) => index + 1)
                      .filter(
                        (value) =>
                          value === 1 ||
                          value === totalPages ||
                          Math.abs(value - safePage) <= 1,
                      )
                      .reduce<number[]>((acc, value) => {
                        if (acc.length && value - acc[acc.length - 1] > 1) acc.push(-1);
                        acc.push(value);
                        return acc;
                      }, [])
                      .map((value, index) =>
                        value === -1 ? (
                          <span key={`gap-${index}`} className="px-1 text-slate-400">
                            …
                          </span>
                        ) : (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setPage(value)}
                            aria-current={value === safePage ? 'page' : undefined}
                            className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
                              value === safePage
                                ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                                : 'border border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:text-orange-600'
                            }`}
                          >
                            {value}
                          </button>
                        ),
                      )}
                    <button
                      type="button"
                      onClick={() => setPage(Math.min(totalPages, safePage + 1))}
                      disabled={safePage === totalPages}
                      className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Suivant →
                    </button>
                  </nav>
                )}
              </section>

              <aside className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <h2 className="font-[var(--font-display)] text-sm font-bold uppercase tracking-wide text-slate-900">
                    Les plus lus
                  </h2>
                  <ol className="mt-3 space-y-3">
                    {mostViewed.slice(0, 6).map((article, index) => (
                      <li key={article.id}>
                        <Link
                          href={`/actualites/${article.slug}`}
                          className="group flex gap-3"
                        >
                          <span className="font-[var(--font-display)] text-2xl font-extrabold leading-none text-orange-200 group-hover:text-orange-400">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <h3 className="line-clamp-2 text-[12.5px] font-semibold leading-snug text-slate-800 group-hover:text-orange-600">
                              {article.title}
                            </h3>
                            <p className="mt-0.5 text-[10.5px] text-slate-500">
                              {article.view_count ?? 0} vues
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                    {mostViewed.length === 0 && (
                      <li className="text-[12px] text-slate-500">
                        Les statistiques de lecture apparaîtront bientôt.
                      </li>
                    )}
                  </ol>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
                  <h2 className="font-[var(--font-display)] text-base font-bold text-slate-900">
                    Une info à partager ?
                  </h2>
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600">
                    Signalez-nous une actualité emploi, formation ou concours
                    vérifiable. La rédaction la traitera en priorité.
                  </p>
                  <Link
                    href="/contact"
                    className="mt-3 inline-flex rounded-lg bg-orange-500 px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-orange-600"
                  >
                    Contacter la rédaction
                  </Link>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

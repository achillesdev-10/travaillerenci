import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { cache } from 'react';
import { ArticleService } from '@/services/articleService';
import { getCachedArticles } from '@/lib/cachedContent';
import CoverImage from '@/components/content/CoverImage';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';
import ShareButton from '@/components/ShareButton';
import ArticleViewPing from '@/components/content/ArticleViewPing';
import { formatDate, formatRelativeTime, truncate } from '@/lib/utils';
import { getSiteUrl } from '@/lib/site';
import { NEWS_CATEGORY_LABELS } from '@/lib/news/categories';
import type { ArticleCategory } from '@/types/article';

export const revalidate = 300;

const getArticle = cache((slug: string) => ArticleService.getBySlug(slug));

const CATEGORY_LABELS: Record<ArticleCategory, string> = NEWS_CATEGORY_LABELS;

const CATEGORY_COLORS: Record<ArticleCategory, string> = {
  emploi: 'bg-orange-500/10 text-orange-700',
  formation: 'bg-orange-500/10 text-orange-700',
  concours: 'bg-orange-500/10 text-orange-700',
  economie: 'bg-orange-500/10 text-orange-700',
  carriere: 'bg-orange-500/10 text-orange-700',
  guide: 'bg-orange-500/10 text-orange-700',
  societe: 'bg-orange-500/10 text-orange-700',
  technologie: 'bg-orange-500/10 text-orange-700',
  afrique: 'bg-orange-500/10 text-orange-700',
  entrepreneuriat: 'bg-orange-500/10 text-orange-700',
  opportunites: 'bg-orange-500/10 text-orange-700',
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article || (article.status !== 'published' && article.status !== 'archived')) {
    return {
      title: 'Article introuvable',
      robots: { index: false, follow: false },
    };
  }

  const desc = truncate(
    (article.seo_description || article.excerpt || '').replace(/[*#]/g, ''),
    170,
  );

  return {
    title: article.seo_title || `${article.title} | TravaillerEnCi`,
    description: desc,
    keywords: article.seo_keywords || undefined,
    robots:
      article.status === 'published'
        ? undefined
        : { index: false, follow: true },
    alternates: {
      canonical: `${getSiteUrl()}/actualites/${article.slug}`,
    },
    openGraph: {
      type: 'article',
      url: `${getSiteUrl()}/actualites/${article.slug}`,
      siteName: 'TravaillerEnCi',
      title: article.title,
      description: desc,
      locale: 'fr_CI',
      ...(article.cover_image ? { images: [{ url: article.cover_image, width: 1200, height: 800, alt: article.title }] } : {}),
      publishedTime: article.published_at || undefined,
      authors: [article.author],
      tags: [article.category],
    },
    twitter: {
      card: 'summary_large_image',
      title: article.title,
      description: desc,
      ...(article.cover_image ? { images: [article.cover_image] } : {}),
    },
  };
}

export default async function ArticleDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const article = await getArticle(slug);

  // Seuls les articles publiés ou archivés sont publics : un brouillon, un
  // article en attente de validation ou rejeté reste réservé au dashboard.
  if (!article || (article.status !== 'published' && article.status !== 'archived')) {
    notFound();
  }

  // JSON-LD
  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.seo_description || article.excerpt,
    author: {
      '@type': 'Organization',
      name: article.author,
    },
    publisher: {
      '@type': 'Organization',
      name: 'TravaillerenCi',
    },
    datePublished: article.published_at,
    dateModified: article.updated_at,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${getSiteUrl()}/actualites/${article.slug}`,
    },
    ...(article.cover_image ? { image: article.cover_image } : {}),
    articleSection: CATEGORY_LABELS[article.category] || article.category,
  };

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${getSiteUrl()}/` },
      { '@type': 'ListItem', position: 2, name: 'Actualités', item: `${getSiteUrl()}/actualites` },
      { '@type': 'ListItem', position: 3, name: article.title, item: `${getSiteUrl()}/actualites/${article.slug}` },
    ],
  };

  // Articles similaires (même catégorie)
  const { rows: related } = await getCachedArticles({
    category: article.category,
    status: 'published',
    limit: 6,
    order_by: 'published_at',
    order_dir: 'desc',
    fields: 'card',
  });
  const similar = related.filter((a) => a.id !== article.id).slice(0, 3);

  const citedSources = (article.sources ?? []).filter(
    (source) => source.allowed_for_citation !== false && source.url,
  );

  return (
    <main className="flex-1 min-h-screen bg-white dark:bg-slate-950 transition-colors">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <ArticleViewPing slug={article.slug} />

      {article.status !== 'published' && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-[12.5px] font-medium text-amber-800">
          Article archivé — conservé pour référence. Les informations peuvent
          avoir évolué depuis sa publication.
        </div>
      )}

      {/* ===== HERO ===== */}
      <section className="bg-primary/5 dark:bg-primary/10 border-b border-line dark:border-slate-800">
        <div className="container mx-auto px-4 pt-4 sm:pt-8 pb-6 sm:pb-10 max-w-4xl">
          {/* Cover image */}
          {article.cover_image && (
            <div className="relative h-48 sm:h-64 overflow-hidden rounded-2xl sm:rounded-3xl shadow-lg mb-5 sm:mb-6">
              <CoverImage
                src={article.cover_image}
                alt={article.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" aria-hidden="true" />
            </div>
          )}

          {/* Breadcrumb */}
          <nav aria-label="Fil d'Ariane" className="mb-4 sm:mb-6">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] sm:text-sm text-black dark:text-white">
              <li><Link href="/" className="hover:text-primary hover:underline">Accueil</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/actualites" className="hover:text-primary hover:underline">Actualités</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-black dark:text-gray-200 font-medium truncate max-w-[60vw]">{article.title}</li>
            </ol>
          </nav>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs sm:text-sm font-bold ${CATEGORY_COLORS[article.category] || ''}`}>
              {CATEGORY_LABELS[article.category] || article.category}
            </span>
            <span className="text-[11px] sm:text-xs text-black/50 dark:text-white/60">
              {article.published_at
                ? `Publié ${formatRelativeTime(article.published_at)}`
                : ''}
            </span>
            <span className="text-[11px] sm:text-xs text-black/50 dark:text-white/60">
              par {article.author}
            </span>
          </div>

          <h1 className="text-[26px] sm:text-3xl lg:text-4xl font-extrabold text-black dark:text-white leading-tight font-[var(--font-display)]">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="mt-3 text-base sm:text-lg text-black dark:text-white max-w-3xl leading-relaxed">
              {article.excerpt}
            </p>
          )}
        </div>
      </section>

      {/* ===== CONTENU ===== */}
      <section className="container mx-auto px-4 py-6 sm:py-10 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Article body */}
          <article className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 shadow-sm shadow-black/5 p-5 sm:p-8">
              <div className="mb-4 flex justify-end">
                <ShareButton
                  title={article.title}
                  text={article.excerpt || article.title}
                  url={`${getSiteUrl()}/actualites/${article.slug}`}
                  campaign="actualite"
                />
              </div>
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-black dark:text-white leading-relaxed">
                <SimpleMarkdown text={article.content} />
              </div>
              <div className="mt-6 flex justify-end">
                <ShareButton
                  title={article.title}
                  text={article.excerpt || article.title}
                  url={`${getSiteUrl()}/actualites/${article.slug}`}
                  campaign="actualite"
                />
              </div>
            </div>

            {/* Sources */}
            {(citedSources.length > 0 || article.source_url) && (
              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-600">
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900">
                      Sources & vérification
                    </p>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                      Article original rédigé par la rédaction à partir des
                      sources ci-dessous.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {citedSources.length > 0 ? (
                        citedSources.map((source, index) => (
                          <li key={`${source.url}-${index}`}>
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-orange-700 hover:underline"
                            >
                              {source.name}
                              {source.published_at && (
                                <span className="font-normal text-slate-500">
                                  ·{' '}
                                  {formatDate(source.published_at)}
                                </span>
                              )}
                              <svg
                                className="h-3.5 w-3.5 opacity-70"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M7 17L17 7" />
                                <path d="M7 7h10v10" />
                              </svg>
                            </a>
                          </li>
                        ))
                      ) : (
                        <li>
                          <a
                            href={article.source_url!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[12.5px] font-medium text-orange-700 hover:underline"
                          >
                            Consulter la source originale
                          </a>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Articles similaires */}
            {similar.length > 0 && (
              <div className="mt-8 sm:mt-10">
                <h2 className="text-lg sm:text-xl font-bold text-black dark:text-white mb-4 font-[var(--font-display)]">
                  Articles similaires
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 list-none m-0 p-0">
                  {similar.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/actualites/${s.slug}`}
                        className="group block bg-white dark:bg-slate-900 rounded-xl border border-line dark:border-slate-800 hover:border-primary/25 hover:shadow-md p-4 transition-all"
                      >
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${CATEGORY_COLORS[s.category] || ''} mb-2`}>
                          {CATEGORY_LABELS[s.category] || s.category}
                        </span>
                        <h3 className="font-bold text-[14px] leading-snug text-black dark:text-white line-clamp-2 mb-1 group-hover:text-primary dark:group-hover:text-brand-accent transition-colors">
                          {s.title}
                        </h3>
                        {s.excerpt && (
                          <p className="text-[12px] text-black dark:text-white line-clamp-2">
                            {truncate(s.excerpt, 100)}
                          </p>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Navigation interne */}
            <nav aria-label="Explorer" className="mt-8 sm:mt-10">
              <h2 className="text-lg sm:text-xl font-bold text-black dark:text-white mb-4 font-[var(--font-display)]">
                Explorer davantage
              </h2>
              <ul className="flex flex-wrap gap-2.5 list-none m-0 p-0">
                <li>
                  <Link
                    href="/actualites"
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    Toutes les actualités
                  </Link>
                </li>
                <li>
                  <Link
                    href="/concours"
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    Concours administratifs
                  </Link>
                </li>
                <li>
                  <Link
                    href="/jobs"
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-3.5 py-2 text-[12.5px] font-semibold text-black transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                  >
                    Offres d&apos;emploi
                  </Link>
                </li>
              </ul>
            </nav>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-1 order-1 lg:order-2 space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 shadow-sm p-5 text-sm">
              <h3 className="font-bold text-black dark:text-white mb-4">Informations</h3>
              <dl className="space-y-3.5">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-black dark:text-white shrink-0">Catégorie</dt>
                  <dd className="text-right">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${CATEGORY_COLORS[article.category] || ''}`}>
                      {CATEGORY_LABELS[article.category] || article.category}
                    </span>
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-black dark:text-white shrink-0">Auteur</dt>
                  <dd className="text-right font-medium text-black dark:text-gray-200">{article.author}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-black dark:text-white shrink-0">Publié le</dt>
                  <dd className="text-right font-medium text-black dark:text-gray-200">
                    {article.published_at ? formatDate(article.published_at) : '—'}
                  </dd>
                </div>
                {article.source_url && (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-black dark:text-white shrink-0">Source</dt>
                    <dd className="text-right">
                      <a
                        href={article.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary dark:text-brand-accent hover:underline inline-flex items-center gap-1"
                      >
                        Voir l&apos;originale
                        <svg className="w-3.5 h-3.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17L17 7" />
                          <path d="M7 7h10v10" />
                        </svg>
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

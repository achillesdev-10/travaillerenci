import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArticleService } from '@/services/articleService';
import CoverImage from '@/components/content/CoverImage';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';
import type { Article } from '@/types/article';
import { formatDate, formatRelativeTime, truncate } from '@/lib/utils';
import { getSiteUrl } from '@/lib/site';
import { IMAGES } from '@/lib/images';

export const revalidate = 300;

const CATEGORY_LABELS: Record<string, string> = {
  emploi: 'Emploi',
  formation: 'Formation',
  concours: 'Concours',
  economie: 'Économie',
  carriere: 'Carrière',
  guide: 'Guide',
};

const CATEGORY_COLORS: Record<string, string> = {
  emploi: 'bg-primary/10 text-primary dark:text-emerald-400',
  formation: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  concours: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  economie: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  carriere: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  guide: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await ArticleService.getBySlug(slug);
  if (!article) {
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
  const article = await ArticleService.getBySlug(slug);

  if (!article) {
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
  const { rows: related } = await ArticleService.list({
    category: article.category,
    status: 'published',
    limit: 6,
    order_by: 'published_at',
    order_dir: 'desc',
  });
  const similar = related.filter((a) => a.id !== article.id).slice(0, 3);

  return (
    <main className="flex-1 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* ===== HERO ===== */}
      <section className="bg-primary/5 dark:bg-primary/10 border-b border-gray-100 dark:border-slate-800">
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
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] sm:text-sm text-gray-500 dark:text-gray-400">
              <li><Link href="/" className="hover:text-primary hover:underline">Accueil</Link></li>
              <li aria-hidden="true">/</li>
              <li><Link href="/actualites" className="hover:text-primary hover:underline">Actualités</Link></li>
              <li aria-hidden="true">/</li>
              <li className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[60vw]">{article.title}</li>
            </ol>
          </nav>

          {/* Meta badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs sm:text-sm font-bold ${CATEGORY_COLORS[article.category] || ''}`}>
              {CATEGORY_LABELS[article.category] || article.category}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">
              {article.published_at
                ? `Publié ${formatRelativeTime(article.published_at)}`
                : ''}
            </span>
            <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">
              par {article.author}
            </span>
          </div>

          <h1 className="text-[26px] sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight font-[var(--font-display)]">
            {article.title}
          </h1>

          {article.excerpt && (
            <p className="mt-3 text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-3xl leading-relaxed">
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
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm shadow-black/5 p-5 sm:p-8">
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
                <SimpleMarkdown text={article.content} />
              </div>
            </div>

            {/* Source link */}
            {article.source_url && (
              <div className="mt-6 bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">Source originale</p>
                    <a
                      href={article.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                    >
                      Consulter la source
                      <svg className="w-3.5 h-3.5 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M7 17L17 7" />
                        <path d="M7 7h10v10" />
                      </svg>
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Articles similaires */}
            {similar.length > 0 && (
              <div className="mt-8 sm:mt-10">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 font-[var(--font-display)]">
                  Articles similaires
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 list-none m-0 p-0">
                  {similar.map((s) => (
                    <li key={s.id}>
                      <Link
                        href={`/actualites/${s.slug}`}
                        className="group block bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-primary/25 hover:shadow-md p-4 transition-all"
                      >
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${CATEGORY_COLORS[s.category] || ''} mb-2`}>
                          {CATEGORY_LABELS[s.category] || s.category}
                        </span>
                        <h3 className="font-bold text-[14px] leading-snug text-gray-900 dark:text-white line-clamp-2 mb-1 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
                          {s.title}
                        </h3>
                        {s.excerpt && (
                          <p className="text-[12px] text-gray-500 dark:text-gray-400 line-clamp-2">
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
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 font-[var(--font-display)]">
                Explorer davantage
              </h2>
              <ul className="flex flex-wrap gap-2.5 list-none m-0 p-0">
                <li>
                  <Link
                    href="/actualites"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Toutes les actualités
                  </Link>
                </li>
                <li>
                  <Link
                    href="/concours"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Concours administratifs
                  </Link>
                </li>
                <li>
                  <Link
                    href="/jobs"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Offres d&apos;emploi
                  </Link>
                </li>
              </ul>
            </nav>
          </article>

          {/* Sidebar */}
          <aside className="lg:col-span-1 order-1 lg:order-2 space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 text-sm">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Informations</h3>
              <dl className="space-y-3.5">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400 shrink-0">Catégorie</dt>
                  <dd className="text-right">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-bold ${CATEGORY_COLORS[article.category] || ''}`}>
                      {CATEGORY_LABELS[article.category] || article.category}
                    </span>
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400 shrink-0">Auteur</dt>
                  <dd className="text-right font-medium text-gray-800 dark:text-gray-200">{article.author}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500 dark:text-gray-400 shrink-0">Publié le</dt>
                  <dd className="text-right font-medium text-gray-800 dark:text-gray-200">
                    {article.published_at ? formatDate(article.published_at) : '—'}
                  </dd>
                </div>
                {article.source_url && (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-gray-500 dark:text-gray-400 shrink-0">Source</dt>
                    <dd className="text-right">
                      <a
                        href={article.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-primary dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
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

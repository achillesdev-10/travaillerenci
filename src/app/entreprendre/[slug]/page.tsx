import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';
import CoverImage from '@/components/content/CoverImage';
import { EntreprendreArticleService } from '@/services/entreprendreService';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { SITE_CONFIG } from '@/lib/constants';
import { IMAGES } from '@/lib/images';
import type { EntreprendreSector, BudgetRange } from '@/types/entreprendre';
import ArticleHelpfulVote from '@/components/entreprendre/ArticleHelpfulVote';
import ArticleComments from '@/components/entreprendre/ArticleComments';

// ISR : revalidation toutes les heures
export const revalidate = 3600;

// Génère statiquement les 50 articles les plus récents au build
export async function generateStaticParams() {
  const { rows } = await EntreprendreArticleService.list({
    status: 'published',
    order_by: 'published_at',
    order_dir: 'desc',
    limit: 50,
  });
  return rows.map((a) => ({ slug: a.slug }));
}

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

// ---------------------------------------------------------------------------
//  SEO Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await EntreprendreArticleService.getBySlug(slug);
  if (!article || article.status !== 'published') return {};

  const description =
    article.meta_description || article.excerpt || `Guide : ${article.title}`;
  const imageUrl = article.cover_image || IMAGES.blog;

  return {
    title: `${article.title} — TravaillerenCi`,
    description,
    openGraph: {
      type: 'article',
      locale: 'fr_CI',
      url: `${SITE_CONFIG.url}/entreprendre/${article.slug}`,
      siteName: 'TravaillerenCi',
      title: `${article.title} | TravaillerenCi`,
      description,
      images: [{ url: imageUrl, width: 1200, height: 630, alt: article.title }],
      publishedTime: article.published_at || undefined,
      modifiedTime: article.updated_at,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${article.title} | TravaillerenCi`,
      description,
      images: [imageUrl],
    },
  };
}

// ---------------------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/**
 * Extrait les titres markdown (##, ###) pour générer un sommaire cliquable.
 */
function extractHeadings(content: string): Array<{ id: string; text: string; level: number }> {
  const headings: Array<{ id: string; text: string; level: number }> = [];
  const lines = content.split('\n');
  for (const line of lines) {
    const match = line.trim().match(/^(#{2,3})\s+(.*)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2]
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .trim();
      const id = text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
      headings.push({ id, text, level });
    }
  }
  return headings;
}

/**
 * Ajoute des ids aux titres dans le HTML généré par SimpleMarkdown.
 * (SimpleMarkdown utilise dangerouslySetInnerHTML, on ne peut pas injecter d'ids
 * directement — on rend le markdown dans un conteneur et on procède par
 * effet de bord après le rendu via un petit script client.)
 */

// ---------------------------------------------------------------------------
//  Page
// ---------------------------------------------------------------------------

export default async function EntreprendreArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await EntreprendreArticleService.getBySlug(slug);
  if (!article || article.status !== 'published') notFound();

  const sector = (article.sector as EntreprendreSector) || 'autre';
  const budget = (article.budget_range as BudgetRange) || 'petit';
  const headings = extractHeadings(article.content);

  // Incrémenter le compteur de vues (fire & forget)
  EntreprendreArticleService.incrementViewCount(article.id).catch(() => {});

  // Offres liées au secteur
  const { rows: relatedJobs } = await JobOfferSchemaService.list({
    status: 'published',
    keyword: SECTOR_LABELS[sector] || sector,
    limit: 3,
    order_by: 'created_at',
    order_dir: 'desc',
  }).catch(() => ({ rows: [], total: 0 }));

  // Articles similaires (même secteur)
  const { rows: similarArticles } = await EntreprendreArticleService.list({
    status: 'published',
    sector: sector,
    limit: 4,
    order_by: 'published_at',
    order_dir: 'desc',
  });
  const similar = similarArticles.filter((a) => a.id !== article.id).slice(0, 3);

  const shareUrl = `${SITE_CONFIG.url}/entreprendre/${article.slug}`;

  // JSON-LD
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.meta_description || article.excerpt || '',
    image: article.cover_image || IMAGES.blog,
    datePublished: article.published_at || article.created_at,
    dateModified: article.updated_at,
    author: {
      '@type': 'Organization',
      name: article.author || 'TravaillerenCi',
    },
    publisher: {
      '@type': 'Organization',
      name: 'TravaillerenCi',
      url: SITE_CONFIG.url,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': shareUrl,
    },
  };

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ===== Couverture ===== */}
      <div className="relative h-56 sm:h-80 lg:h-96 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
        <CoverImage
          src={article.cover_image || IMAGES.blog}
          alt={article.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      </div>

      {/* ===== Article ===== */}
      <div className="container mx-auto px-4 -mt-10 sm:-mt-14 relative z-10 max-w-3xl">
        <article className="bg-white dark:bg-slate-900 border border-border rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
          <div className="p-6 sm:p-10">
            {/* Breadcrumb */}
            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
              <Link
                href="/entreprendre"
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-3 py-1.5 font-bold hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
                Entreprendre
              </Link>
              <span className="rounded-full border border-border bg-gray-50 dark:bg-slate-800 px-3 py-1.5 font-semibold">
                {SECTOR_LABELS[sector] || sector}
              </span>
              <span className="rounded-full border border-border bg-gray-50 dark:bg-slate-800 px-3 py-1.5 font-semibold">
                {BUDGET_LABELS[budget]}
              </span>
            </div>

            {/* Titre */}
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white font-[var(--font-display)] leading-tight">
              {article.title}
            </h1>

            {/* Meta auteur + date */}
            <div className="mt-5 flex items-center gap-3 border-y border-border/60 py-4">
              <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm">
                {article.author.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{article.author}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Publié le {formatDate(article.published_at)}
                  {article.published_at !== article.updated_at && (
                    <span> · Mis à jour le {formatDate(article.updated_at)}</span>
                  )}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  ⏱ {article.reading_time} min
                </span>
                <span className="text-[11px] text-gray-400 dark:text-gray-500">
                  👁 {article.view_count}
                </span>
                {/* Partage */}
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${article.title} — ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Partager sur WhatsApp"
                  className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-emerald-500 hover:text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Partager sur Facebook"
                  className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-blue-500 hover:text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Sommaire cliquable */}
            {headings.length >= 2 && (
              <div className="mt-6 rounded-2xl bg-gray-50 dark:bg-slate-800/50 border border-border p-5">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" x2="21" y1="6" y2="6" />
                    <line x1="8" x2="21" y1="12" y2="12" />
                    <line x1="8" x2="21" y1="18" y2="18" />
                    <line x1="3" x2="3.01" y1="6" y2="6" />
                    <line x1="3" x2="3.01" y1="12" y2="12" />
                    <line x1="3" x2="3.01" y1="18" y2="18" />
                  </svg>
                  Sommaire
                </h2>
                <nav aria-label="Sommaire">
                  <ul className="space-y-1.5">
                    {headings.map((h) => (
                      <li key={h.id}>
                        <a
                          href={`#${h.id}`}
                          className={`block text-sm hover:text-primary transition-colors ${
                            h.level === 3 ? 'pl-4' : ''
                          } ${
                            'text-gray-600 dark:text-gray-300 font-medium'
                          }`}
                        >
                          {h.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>
            )}

            {/* Corps de l'article */}
            <div
              id="article-content"
              className="mt-6 text-[15px] sm:text-base leading-relaxed text-gray-700 dark:text-gray-300"
            >
              <SimpleMarkdownWithAnchors content={article.content} />
            </div>

            {/* Encadré "Offres liées" */}
            {relatedJobs.length > 0 && (
              <div className="mt-8 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 p-5 sm:p-6">
                <h2 className="text-sm font-bold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
                  </svg>
                  Offres liées à ce secteur
                </h2>
                <div className="space-y-2">
                  {relatedJobs.map((job) => (
                    <Link
                      key={job.id}
                      href={`/jobs/${job.id}`}
                      className="block rounded-xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/30 p-3 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors"
                    >
                      <div className="text-sm font-bold text-gray-900 dark:text-white line-clamp-1">
                        {job.title}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {job.company} · {job.location}
                      </div>
                    </Link>
                  ))}
                </div>
                <Link
                  href={`/jobs`}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 hover:underline"
                >
                  Voir toutes les offres →
                </Link>
              </div>
            )}

            {/* Vote "Cet article vous a aidé ?" */}
            <ArticleHelpfulVote
              articleId={article.id}
              initialCount={article.helpful_count}
            />
          </div>
        </article>

        {/* ===== Section commentaires ===== */}
        <div className="mt-8">
          <ArticleComments articleId={article.id} />
        </div>

        {/* ===== Articles similaires ===== */}
        {similar.length > 0 && (
          <div className="mt-12 pb-10">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)] mb-5">
              Articles similaires
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {similar.map((a) => (
                <Link
                  key={a.id}
                  href={`/entreprendre/${a.slug}`}
                  className="group bg-white dark:bg-slate-900 border border-border rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all"
                >
                  <div className="h-28 bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <CoverImage
                      src={a.cover_image || IMAGES.blog}
                      alt={a.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-4">
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-1">
                      {SECTOR_LABELS[(a.sector as EntreprendreSector) || 'autre']} · ⏱ {a.reading_time} min
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                      {a.title}
                    </h3>
                    {a.excerpt && (
                      <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                        {a.excerpt}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
//  Composant markdown avec ancres sur les titres
// ---------------------------------------------------------------------------

/**
 * SimpleMarkdownWithAnchors rend le contenu Markdown en ajoutant des ids
 * aux titres pour le sommaire cliquable. Le rendu est identique à
 * SimpleMarkdown, mais les titres h2/h3 reçoivent un attribut id.
 */
function SimpleMarkdownWithAnchors({ content }: { content: string }) {
  // On utilise SimpleMarkdown standard — les ancres sont gérées par un petit
  // script inline qui ajoute les ids au montage.
  return (
    <>
      <SimpleMarkdown text={content} />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var targets = document.querySelectorAll('#article-content h2, #article-content h3');
              targets.forEach(function(el) {
                var text = el.textContent || '';
                var id = text.toLowerCase()
                  .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
                  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
                  .slice(0, 80);
                if (id) el.id = id;
              });
            })();
          `,
        }}
      />
    </>
  );
}

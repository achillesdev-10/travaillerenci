import Link from 'next/link';
import { BlogService } from '@/services/blogService';
import CoverImage from '@/components/content/CoverImage';
import type { BlogPost } from '@/types/blog';
import { formatDateShort } from '@/lib/utils';
import { getSiteUrl } from '@/lib/site';
import { IMAGES } from '@/lib/images';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Blog — TravaillerenCi',
  description:
    "Conseils emploi, actualités du marché du travail et coulisses de la plateforme : le blog TravaillerenCi pour réussir votre carrière en Côte d'Ivoire.",
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    url: `${getSiteUrl()}/blog`,
    siteName: 'TravaillerenCi',
    title: 'Blog — Conseils & actualités | TravaillerenCi',
    description:
      "Conseils emploi, actualités du marché du travail ivoirien et coulisses de la plateforme TravaillerenCi.",
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog — Conseils & actualités | TravaillerenCi',
    description:
      "Conseils emploi, actualités du marché du travail ivoirien et coulisses de la plateforme TravaillerenCi.",
  },
};

function formatDate(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

function tagList(tags: string | null): string[] {
  return (tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export default async function BlogPage() {
  const { rows: posts, total } = await BlogService.list({
    status: 'published',
    order_by: 'published_at',
    order_dir: 'desc',
    limit: 50,
  });

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
            Le blog TravaillerenCi
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-[var(--font-display)] text-gray-900 dark:text-white">
            Conseils & actualités
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Des astuces pour vos candidatures, les tendances du marché du travail ivoirien et
            les nouveautés de la plateforme.
          </p>
        </div>
      </section>

      {/* ===== Liste des articles ===== */}
      <section className="container mx-auto px-4 py-10 sm:py-14 max-w-5xl">
        {posts.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-border rounded-2xl p-10 sm:p-16 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7 text-gray-400" aria-hidden="true">
                <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
                <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
              </svg>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)]">
              Aucun article publié pour le moment
            </h2>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mt-2 max-w-md mx-auto">
              Revenez bientôt : nos premiers articles sur l&apos;emploi en Côte d&apos;Ivoire
              arrivent très vite !
            </p>
            <Link
              href="/jobs"
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-white font-semibold text-sm shadow-md shadow-primary/20 hover:brightness-110 transition-all"
            >
              Voir les offres d&apos;emploi
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              <strong className="text-gray-800 dark:text-gray-200">{total}</strong>{' '}
              article{total > 1 ? 's' : ''} publié{total > 1 ? 's' : ''}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
              {posts.map((post) => (
                <BlogCard key={post.id} post={post} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  const tags = tagList(post.tags);
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex flex-col bg-white dark:bg-slate-900 border border-border rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-200"
    >
      {/* Couverture */}
      <div className="relative h-28 overflow-hidden bg-gray-100 dark:bg-slate-800 sm:h-40">
        <CoverImage
          src={post.cover_image || IMAGES.blog}
          alt={post.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {tags.length > 0 && (
          <span className="absolute top-3 left-3 inline-flex items-center rounded-full bg-white/90 dark:bg-slate-950/80 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-primary shadow-sm">
            {tags[0]}
          </span>
        )}
      </div>

      {/* Corps */}
      <div className="flex flex-col flex-1 p-3.5 sm:p-5">
        <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-2">
          <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span className="hidden sm:inline">{formatDate(post.published_at)}</span>
          <span className="sm:hidden">{post.published_at ? formatDateShort(post.published_at) : ''}</span>
          <span aria-hidden="true">•</span>
          <span className="truncate">{post.author}</span>
        </div>
        <h2 className="text-[13px] sm:text-lg font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {post.title}
        </h2>
        {post.excerpt && (
          <p className="mt-1.5 sm:mt-2 text-[11.5px] sm:text-sm text-gray-600 dark:text-gray-400 leading-relaxed line-clamp-3 flex-1">
            {post.excerpt}
          </p>
        )}
        <div className="mt-3 sm:mt-4 inline-flex items-center gap-1.5 text-[11.5px] sm:text-sm font-semibold text-primary">
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

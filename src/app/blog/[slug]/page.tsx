import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';
import CoverImage from '@/components/content/CoverImage';
import { BlogService } from '@/services/blogService';
import { SITE_CONFIG } from '@/lib/constants';
import { IMAGES } from '@/lib/images';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await BlogService.getBySlug(slug);
  if (!post || post.status !== 'published') return {};
  return {
    title: `${post.title} — TravaillerenCi`,
    description: post.excerpt || undefined,
  };
}

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
    .filter(Boolean);
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await BlogService.getBySlug(slug);
  if (!post || post.status !== 'published') notFound();

  const tags = tagList(post.tags);
  const { rows: related } = await BlogService.list({
    status: 'published',
    limit: 3,
    order_by: 'published_at',
    order_dir: 'desc',
  });
  const relatedPosts = related.filter((p) => p.id !== post.id).slice(0, 2);

  const shareUrl = `${SITE_CONFIG.url}/blog/${post.slug}`;

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* ===== Couverture ===== */}
      <div className="relative h-56 sm:h-80 lg:h-96 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
        <CoverImage
          src={post.cover_image || IMAGES.blog}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
      </div>

      {/* ===== Article ===== */}
      <div className="container mx-auto px-4 -mt-10 sm:-mt-14 relative z-10 max-w-3xl">
        <article className="bg-white dark:bg-slate-900 border border-border rounded-3xl shadow-xl shadow-black/5 overflow-hidden">
          <div className="p-6 sm:p-10">
            <div className="flex flex-wrap items-center gap-2 text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 font-medium mb-4">
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 text-primary px-3 py-1.5 font-bold hover:bg-primary/15 transition-colors"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
                Blog
              </Link>
              {tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border bg-gray-50 dark:bg-slate-800 px-3 py-1.5 font-semibold"
                >
                  #{t}
                </span>
              ))}
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white font-[var(--font-display)] leading-tight">
              {post.title}
            </h1>

            <div className="mt-5 flex items-center gap-3 border-y border-border/60 py-4">
              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
                {post.author.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">{post.author}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Publié le {formatDate(post.published_at)}
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Partager sur Facebook"
                  className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </a>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${post.title} — ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Partager sur WhatsApp"
                  className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Corps de l'article */}
            <div className="mt-6 text-[15px] sm:text-base leading-relaxed text-gray-700 dark:text-gray-300">
              <SimpleMarkdown text={post.content} />
            </div>
          </div>
        </article>

        {/* ===== CTA ===== */}
        <div className="mt-8 rounded-3xl bg-primary p-7 sm:p-9 text-center text-white shadow-xl shadow-primary/20">
          <h2 className="text-xl sm:text-2xl font-extrabold font-[var(--font-display)]">
            Trouvez votre prochaine opportunité
          </h2>
          <p className="mt-2 text-sm sm:text-base text-white/85 max-w-lg mx-auto">
            Des centaines d&apos;offres d&apos;emploi, de stages et de bourses vérifiées vous
            attendent sur TravaillerenCi.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/jobs"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-gray-900 font-bold text-sm hover:bg-gray-100 transition-colors shadow-lg"
            >
              Voir les offres
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/generateur-de-cv"
              className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-white font-bold text-sm hover:bg-white/10 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                <path d="M14 2v6h6" />
                <path d="M9 13h6M9 17h4" />
              </svg>
              Créer mon CV
            </Link>
          </div>
        </div>

        {/* ===== Articles liés ===== */}
        {relatedPosts.length > 0 && (
          <div className="mt-12 pb-10">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)] mb-5">
              À lire aussi
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedPosts.map((p) => (
                <Link
                  key={p.id}
                  href={`/blog/${p.slug}`}
                  className="group bg-white dark:bg-slate-900 border border-border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all"
                >
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-medium mb-1.5">
                    {formatDate(p.published_at)}
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white group-hover:text-primary transition-colors line-clamp-2">
                    {p.title}
                  </h3>
                  {p.excerpt && (
                    <p className="mt-1.5 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                      {p.excerpt}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

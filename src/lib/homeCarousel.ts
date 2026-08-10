/**
 *  TravaillerEnCi — src/lib/homeCarousel.ts
 *  Construction partagée des slides du carrousel « À la une » (home).
 *
 *  Utilisée par :
 *    • /api/home/carousel (GET)  — avec images OpenGraph des sources,
 *    • src/app/page.tsx          — SANS images (rendu serveur immédiat) pour
 *      que les titres des opportunités soient présents dans le HTML brut
 *      (SEO + partage), au lieu d'un « Chargement des opportunités… ».
 */

import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { ExamService } from '@/services/examService';
import { BlogService } from '@/services/blogService';
import type { ContentCategory, JobOfferSchema } from '@/types';
import type { Exam } from '@/types/exam';
import type { BlogPost } from '@/types/blog';
import { getSiteHostname } from '@/lib/site';
import { IMAGES, jobDefaultImage, examDefaultImage } from '@/lib/images';

export interface CarouselSlide {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  type: 'offre' | 'stage' | 'bourse' | 'concours' | 'blog';
  image: string | null;
  sourceUrl: string | null;
  fallback: {
    domain: string;
    initial: string;
    color: string;
  };
}

// -----------------------------------------------------------------------------
// Cache mémoire des images OpenGraph (évite de re-scraper chaque source à
// chaque requête : la réponse de la route est elle-même revalidée par Next).
// -----------------------------------------------------------------------------
const ogImageCache = new Map<string, { value: string | null; expires: number }>();
const inFlight = new Map<string, Promise<string | null>>();

const TTL = 6 * 3600 * 1000; // 6 h
const FETCH_TIMEOUT = 4000;

async function fetchOgImage(url: string): Promise<string | null> {
  const cached = ogImageCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value;
  if (inFlight.has(url)) return inFlight.get(url)!;

  const promise = (async () => {
    let image: string | null = null;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'user-agent': `Mozilla/5.0 (TravaillerEnCi/1.0 +https://${getSiteHostname()})`,
          accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
        cache: 'no-store',
      });
      clearTimeout(timer);
      if (res.ok) {
        const html = await res.text();
        const og =
          html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
        if (og && og[1]) {
          image = og[1].startsWith('//') ? `https:${og[1]}` : og[1];
        }
        if (!image) {
          const link =
            html.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i) ||
            html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']image_src["']/i);
          if (link && link[1]) image = link[1];
        }
      }
    } catch {
      image = null;
    }
    ogImageCache.set(url, { value: image, expires: Date.now() + TTL });
    return image;
  })();

  inFlight.set(url, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(url);
  }
}

function getDomain(url: string | null): string {
  if (!url) return getSiteHostname();
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return getSiteHostname();
  }
}

const COLORS = [
  'bg-orange-500',
  'bg-emerald-600',
  'bg-sky-600',
  'bg-purple-600',
  'bg-rose-500',
  'bg-slate-800',
];

function fallbackFor(url: string | null, title: string, index: number): CarouselSlide['fallback'] {
  const domain = getDomain(url);
  return {
    domain,
    initial: (title.trim().charAt(0) || 'T').toUpperCase(),
    color: COLORS[index % COLORS.length],
  };
}

export interface BuildCarouselOptions {
  /** Récupère les images OpenGraph des sources (route API uniquement — lent). */
  withOgImages?: boolean;
  /** Nombre maximal de slides (défaut : 8). */
  maxSlides?: number;
  /** Données déjà chargées par la page (évite des requêtes redondantes). */
  offers?: JobOfferSchema[];
  exams?: Exam[];
  posts?: BlogPost[];
}

/**
 * Construit les slides du carrousel : offres, stages, bourses, concours et
 * derniers articles du blog — dans cet ordre de priorité.
 *
 * Accepte des données pré-chargées (la home les récupère déjà pour le fil
 * actu) pour ne pas multiplier les requêtes BDD.
 */
export async function buildCarouselSlides(
  options: BuildCarouselOptions = {},
): Promise<{ slides: CarouselSlide[] }> {
  const { withOgImages = false, maxSlides = 8 } = options;

  let offers: JobOfferSchema[];
  let exams: Exam[];
  let posts: BlogPost[];
  if (options.offers && options.exams && options.posts) {
    offers = options.offers.slice(0, 6);
    exams = options.exams.slice(0, 4);
    posts = options.posts.slice(0, 3);
  } else {
    const [o, e, b] = await Promise.all([
      JobOfferSchemaService.list({
        status: 'published',
        category: ['job', 'internship', 'scholarship'],
        limit: 6,
        order_by: 'created_at',
        order_dir: 'desc',
      }),
      ExamService.list({ status: 'published', limit: 4, order_by: 'created_at', order_dir: 'desc' }),
      BlogService.list({ status: 'published', limit: 3, order_by: 'published_at', order_dir: 'desc' }),
    ]);
    offers = o.rows;
    exams = e.rows;
    posts = b.rows;
  }

  const slides: CarouselSlide[] = [];

  for (const [i, job] of offers.entries()) {
    const cat = (job.category || 'job') as ContentCategory;
    const type: CarouselSlide['type'] =
      cat === 'internship' ? 'stage' : cat === 'scholarship' ? 'bourse' : 'offre';
    slides.push({
      id: `job-${job.id}`,
      title: job.title,
      subtitle: `${job.company} · ${job.location}`,
      href: `/jobs/${job.id}`,
      type,
      // Image par défaut par catégorie (les annonces scrapées n'ont pas d'image)
      image: jobDefaultImage(job.category),
      sourceUrl: job.source_url || job.apply_link,
      fallback: fallbackFor(job.source_url || job.apply_link, job.title, i),
    });
  }

  for (const [i, exam] of exams.entries()) {
    slides.push({
      id: `exam-${exam.id}`,
      title: exam.title,
      subtitle: `${exam.organizer} · Concours ${exam.category}`,
      href: `/concours/${exam.slug || exam.id}`,
      type: 'concours',
      // Image par défaut par catégorie de concours
      image: examDefaultImage(exam.category),
      sourceUrl: exam.source_url,
      fallback: fallbackFor(exam.source_url, exam.title, i + offers.length),
    });
  }

  for (const [i, post] of posts.entries()) {
    slides.push({
      id: `post-${post.id}`,
      title: post.title,
      subtitle: `Blog · ${post.author}`,
      href: `/blog/${post.slug}`,
      type: 'blog',
      image: post.cover_image || IMAGES.blog,
      sourceUrl: null,
      fallback: fallbackFor(null, post.title, i + offers.length + exams.length),
    });
  }

  const trimmed = slides.slice(0, maxSlides);

  if (!withOgImages) {
    return { slides: trimmed };
  }

  // Récupération asynchrone des images OpenGraph depuis les sites d'origine.
  // On tente l'image réelle d'abord ; si elle est absente ou échoue, la slide
  // garde son image par défaut par catégorie (déjà renseignée).
  const results = await Promise.allSettled(
    trimmed.map((s) =>
      s.sourceUrl ? fetchOgImage(s.sourceUrl) : Promise.resolve(s.image),
    ),
  );

  results.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value) {
      trimmed[i].image = r.value;
    }
  });

  return { slides: trimmed };
}

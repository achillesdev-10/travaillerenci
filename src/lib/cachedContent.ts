import 'server-only';
import { unstable_cache } from 'next/cache';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { ExamService } from '@/services/examService';
import { BlogService } from '@/services/blogService';
import { ArticleService } from '@/services/articleService';
import { EntreprendreArticleService } from '@/services/entreprendreService';
import type { JobOfferSchemaFilters } from '@/types';
import type { ExamFilters } from '@/types/exam';
import type { BlogPostFilters } from '@/types/blog';
import type { ArticleFilters } from '@/types/article';
import type { EntreprendreArticleFilters } from '@/types/entreprendre';

const LIST_REVALIDATE = 120;

const cachedJobs = unstable_cache(
  (filters: JobOfferSchemaFilters) => JobOfferSchemaService.list(filters),
  ['public-job-list'],
  { revalidate: LIST_REVALIDATE, tags: ['job-offers'] },
);

const cachedExams = unstable_cache(
  (filters: ExamFilters) => ExamService.list(filters),
  ['public-exam-list'],
  { revalidate: LIST_REVALIDATE, tags: ['exams'] },
);

const cachedExamOrganizers = unstable_cache(
  () => ExamService.listOrganizers(),
  ['public-exam-organizers'],
  { revalidate: LIST_REVALIDATE, tags: ['exams'] },
);

const cachedPosts = unstable_cache(
  (filters: BlogPostFilters) => BlogService.list(filters),
  ['public-blog-list'],
  { revalidate: LIST_REVALIDATE, tags: ['blog'] },
);

/**
 * Article de blog par slug : la page /blog/[slug] incrémente le compteur de
 * vues à CHAQUE visite (effet de bord par requête) → elle reste en rendu
 * dynamique plutôt qu'en ISR. Mettre la lecture en cache par slug (120 s)
 * évite de re-télécharger l'article complet à chaque visite (egress Supabase).
 */
const cachedPostBySlug = unstable_cache(
  (slug: string) => BlogService.getBySlug(slug),
  ['public-blog-post'],
  { revalidate: LIST_REVALIDATE, tags: ['blog'] },
);

const cachedArticles = unstable_cache(
  (filters: ArticleFilters) => ArticleService.list(filters),
  ['public-article-list'],
  { revalidate: LIST_REVALIDATE, tags: ['articles'] },
);

const cachedEntreprendre = unstable_cache(
  (filters: EntreprendreArticleFilters) => EntreprendreArticleService.list(filters),
  ['public-entreprendre-list'],
  { revalidate: LIST_REVALIDATE, tags: ['entreprendre'] },
);

/**
 * Les recherches libres créent une clé de cache par requête : on les laisse
 * passer directement en base pour éviter de saturer le cache.
 */
export function getCachedJobs(filters: JobOfferSchemaFilters) {
  return filters.keyword ? JobOfferSchemaService.list(filters) : cachedJobs(filters);
}

export function getCachedExams(filters: ExamFilters) {
  return filters.keyword ? ExamService.list(filters) : cachedExams(filters);
}

export function getCachedExamOrganizers() {
  return cachedExamOrganizers();
}

export function getCachedPosts(filters: BlogPostFilters) {
  return filters.keyword ? BlogService.list(filters) : cachedPosts(filters);
}

export function getCachedPostBySlug(slug: string) {
  return cachedPostBySlug(slug);
}

export function getCachedArticles(filters: ArticleFilters) {
  return filters.keyword ? ArticleService.list(filters) : cachedArticles(filters);
}

export function getCachedEntreprendre(filters: EntreprendreArticleFilters) {
  return filters.keyword?.trim()
    ? EntreprendreArticleService.list(filters)
    : cachedEntreprendre(filters);
}

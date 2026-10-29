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
/**
 * TTL long : variante utilisée par des pages ISR 24 h (/jobs/[id] → articles
 * liés). Sans elle, une entrée revalidate=120 fixerait la revalidation
 * effective de TOUTE la page à 120 s (minimum de l'arbre). La fraîcheur est
 * assurée par revalidateTag('blog') à chaque publication (revalidateBlogSurfaces).
 */
const LIST_REVALIDATE_1D = 86400;

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

const cachedPostsLong = unstable_cache(
  (filters: BlogPostFilters) => BlogService.list(filters),
  ['public-blog-list-1d'],
  { revalidate: LIST_REVALIDATE_1D, tags: ['blog'] },
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

/** Identique à getCachedPosts mais avec un TTL de 24 h (pages ISR longues). */
export function getCachedPostsLong(filters: BlogPostFilters) {
  return filters.keyword ? BlogService.list(filters) : cachedPostsLong(filters);
}

export function getCachedArticles(filters: ArticleFilters) {
  return filters.keyword ? ArticleService.list(filters) : cachedArticles(filters);
}

export function getCachedEntreprendre(filters: EntreprendreArticleFilters) {
  return filters.keyword?.trim()
    ? EntreprendreArticleService.list(filters)
    : cachedEntreprendre(filters);
}

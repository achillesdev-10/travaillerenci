import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';
import { ExamService } from '@/services/examService';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { BlogService } from '@/services/blogService';
import { DIPLOMA_SEO } from '@/lib/examSeo';
import { EXAM_CATEGORIES } from '@/lib/examConstants';

export const revalidate = 86400; // 24 h

// Domaine actuel (vercel.app) — bascule sur travaillerenci.ci via
// NEXT_PUBLIC_SITE_URL quand le domaine sera actif.
const BASE_URL = getSiteUrl();

const STATIC_ROUTES = [
  '',
  '/jobs',
  '/stages',
  '/concours',
  '/bourses',
  '/blog',
  '/candidates',
  '/companies',
  '/generateur-de-cv',
  '/about',
  '/careers',
  '/contact',
  '/cgu',
  '/mentions-legales',
  '/politique-de-confidentialite',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: now,
    changeFrequency: route === '' ? 'daily' : 'weekly',
    priority:
      route === ''
        ? 1
        : route === '/jobs' || route === '/stages' || route === '/concours'
          ? 0.9
          : 0.6,
  }));

  // Portes d'entrée SEO concours : pages catégorie + diplôme (contenu unique).
  const categoryEntries: MetadataRoute.Sitemap = EXAM_CATEGORIES.map((c) => ({
    url: `${BASE_URL}/concours/categorie/${c.value}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.7,
  }));
  const diplomaEntries: MetadataRoute.Sitemap = DIPLOMA_SEO.map((d) => ({
    url: `${BASE_URL}/concours/diplome/${d.slug}`,
    lastModified: now,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  // Concours publiés — prioritaires (module Concours Administratifs).
  const [examRes, jobRes, bourseRes, blogRes] = await Promise.allSettled([
    ExamService.list({ status: 'published', limit: 500, order_by: 'created_at', order_dir: 'desc' }),
    JobOfferSchemaService.list({ status: 'published', category: ['job', 'internship'], limit: 500, order_by: 'created_at', order_dir: 'desc' }),
    JobOfferSchemaService.list({ status: 'published', category: 'scholarship', limit: 200, order_by: 'created_at', order_dir: 'desc' }),
    BlogService.list({ status: 'published', limit: 500 }),
  ]);

  const examEntries: MetadataRoute.Sitemap =
    examRes.status === 'fulfilled'
      ? examRes.value.rows.map((exam) => ({
          // URL SEO descriptive (slug) — les URLs legacy par ID redirigent en 308.
          url: `${BASE_URL}/concours/${exam.slug || exam.id}`,
          lastModified: new Date(exam.updated_at || exam.created_at),
          changeFrequency: 'daily',
          priority: 0.8,
        }))
      : [];

  const jobEntries: MetadataRoute.Sitemap =
    jobRes.status === 'fulfilled'
      ? jobRes.value.rows.map((job) => ({
          url: `${BASE_URL}/jobs/${job.id}`,
          lastModified: new Date(job.updated_at || job.created_at),
          changeFrequency: 'daily',
          priority: 0.7,
        }))
      : [];

  const bourseEntries: MetadataRoute.Sitemap =
    bourseRes.status === 'fulfilled'
      ? bourseRes.value.rows.map((bourse) => ({
          url: `${BASE_URL}/bourses/${bourse.id}`,
          lastModified: new Date(bourse.updated_at || bourse.created_at),
          changeFrequency: 'weekly',
          priority: 0.6,
        }))
      : [];

  const blogEntries: MetadataRoute.Sitemap =
    blogRes.status === 'fulfilled'
      ? blogRes.value.rows.map((post) => ({
          url: `${BASE_URL}/blog/${post.slug}`,
          lastModified: new Date(post.updated_at || post.created_at),
          changeFrequency: 'weekly',
          priority: 0.6,
        }))
      : [];

  return [
    ...staticEntries,
    ...categoryEntries,
    ...diplomaEntries,
    ...examEntries,
    ...jobEntries,
    ...bourseEntries,
    ...blogEntries,
  ];
}

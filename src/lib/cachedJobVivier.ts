import 'server-only';
import { unstable_cache } from 'next/cache';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import type { JobOfferSchema } from '@/types';

export type JobVivierScope = 'jobs' | 'stages' | 'both';

const CATEGORIES: Record<JobVivierScope, Array<'job' | 'internship'>> = {
  jobs: ['job'],
  stages: ['internship'],
  both: ['job', 'internship'],
};

/**
 * Les pages SEO n'ont besoin que du début de la description pour leur
 * correspondance mots-clés. Tronquer avant la mise en cache réduit fortement
 * la taille de l'entrée sans modifier l'affichage des cartes.
 */
const SEO_DESCRIPTION_MAX_LENGTH = 1200;

async function loadVivier(scope: JobVivierScope): Promise<JobOfferSchema[]> {
  const { rows } = await JobOfferSchemaService.list({
    category: CATEGORIES[scope],
    status: 'published',
    is_archived: false,
    is_expired: false,
    order_by: 'created_at',
    order_dir: 'desc',
    limit: 500,
  });

  return rows.map((offer) => ({
    ...offer,
    description: (offer.description || '').slice(0, SEO_DESCRIPTION_MAX_LENGTH),
  }));
}

/**
 * Vivier partagé par toutes les pages SEO (villes, métiers, combinaisons).
 * Sans ce cache, chaque page dynamique ou revalidation ISR relançait la même
 * requête de 500 lignes complètes.
 *
 * TTL 24 h : /jobs/[id] est ISR 86400 et une entrée plus courte ici
 * rabaisserait la revalidation effective de toute la page à cette durée ;
 * la fraîcheur est assurée par revalidateTag('job-offers') à chaque
 * publication / modification (revalidateJobSurfaces).
 */
export const getCachedJobVivier = unstable_cache(loadVivier, ['job-vivier'], {
  revalidate: 86400,
  tags: ['job-offers', 'job-vivier'],
});

async function loadScholarships(): Promise<{ rows: JobOfferSchema[]; total: number }> {
  return JobOfferSchemaService.list({
    category: 'scholarship',
    status: 'published',
    is_expired: false,
    limit: 100,
    order_by: 'created_at',
    order_dir: 'desc',
  });
}

/** Liste des bourses : 100 descriptions complètes, revalidée toutes les 10 min. */
export const getCachedScholarships = unstable_cache(loadScholarships, ['scholarships'], {
  revalidate: 600,
  tags: ['job-offers', 'scholarships'],
});

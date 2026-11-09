import 'server-only';
import { unstable_cache } from 'next/cache';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import type { JobContractType, JobOfferSchema } from '@/types';

/**
 *  TravaillerEnCi — src/lib/cachedJobOffer.ts
 *
 *  Caches « fiche offre » pour /jobs/[id] : lecture, résolution par slug
 *  et listes d'offres similaires.
 *
 *  Perf CPU : la fiche coûtait ~120 ms par rendu (4 requêtes BDD dont une
 *  de 500 lignes). Tout est ici mis en Data Cache avec une durée de 24 h,
 *  SANS changer l'affichage :
 *  • invalidation à la demande via le tag `job-offers` — déjà déclenché par
 *    revalidateJobSurfaces() à chaque publication / modification / purge
 *    (recruteur, admin, scraper) ;
 *  • l'expiration d'une offre (date limite dépassée) est désormais gérée
 *    côté client (JobExpiryBanner), elle ne dépend plus d'un rendu serveur.
 */

/** Durée d'entrée cache = durée de revalidation ISR de /jobs/[id]. */
export const JOB_DETAIL_REVALIDATE = 86400;

/** Lecture d'une offre par ID (URL canonique). */
export const getJobByIdCached = unstable_cache(
  async (id: string): Promise<JobOfferSchema | null> => JobOfferSchemaService.getById(id),
  ['job-offer-by-id'],
  { revalidate: JOB_DETAIL_REVALIDATE, tags: ['job-offers'] },
);

/** Résolution par slug SEO legacy (→ redirection 308 vers /jobs/{id}). */
export const getJobBySlugCached = unstable_cache(
  async (slug: string): Promise<JobOfferSchema | null> => JobOfferSchemaService.getBySlug(slug),
  ['job-offer-by-slug'],
  { revalidate: JOB_DETAIL_REVALIDATE, tags: ['job-offers'] },
);

/** Ligne « fiche » : toutes les colonnes sauf filtre — shape identique au direct. */
export type SimilarOffersPage = { rows: JobOfferSchema[]; total: number };

/**
 * Offres similaires — même type de contrat.
 * Une clé de cache par valeur de contrat (3 cas réels : CDI / CDD / Stage).
 */
export const getSimilarJobsByContract = unstable_cache(
  async (input: { contractType: JobContractType }): Promise<SimilarOffersPage> =>
    JobOfferSchemaService.list({
      category: ['job', 'internship'],
      contract_type: input.contractType,
      limit: 4,
      fields: 'card',
    }),
  ['similar-jobs-by-contract'],
  { revalidate: JOB_DETAIL_REVALIDATE, tags: ['job-offers'] },
);

/**
 * Offres similaires — même ville (partie avant « , » / « - » : la ville
 * « propre » déjà calculée par la page).
 */
export const getSimilarJobsByCity = unstable_cache(
  async (input: { city: string }): Promise<SimilarOffersPage> =>
    JobOfferSchemaService.list({
      category: ['job', 'internship'],
      location: input.city,
      limit: 4,
      fields: 'card',
    }),
  ['similar-jobs-by-city'],
  { revalidate: JOB_DETAIL_REVALIDATE, tags: ['job-offers'] },
);

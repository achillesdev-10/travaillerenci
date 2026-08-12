/**
 *  TravaillerEnCi — Assistant : couche de recherche en base
 *  Chemin : src/services/assistant/searchService.ts
 *
 *  Source de vérité : la base de données du site (job_offers + exams),
 *  via les services existants (JobOfferSchemaService / ExamService), qui
 *  basculent automatiquement SQLite ↔ Supabase selon la config.
 *
 *  Ne retourne JAMAIS d'offre inventée : chaque résultat vient d'une ligne
 *  réelle, avec une URL construite à partir des champs de la base.
 */

import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { ExamService } from '@/services/examService';
import { examUrl } from '@/lib/examConstants';
import { formatRelativeTime } from '@/lib/utils';
import type { AssistantCategory, AssistantResult, AssistantSearchCriteria } from './types';

const MAX_RESULTS = 5;

/** Nombre max de mots-clés envoyés en requête (évite les requêtes trop larges). */
const MAX_KEYWORDS = 3;

function cleanKeywords(keywords: string[]): string[] {
  const unique = Array.from(
    new Set(keywords.map((k) => k.trim()).filter((k) => k.length > 0)),
  );
  return unique.slice(0, MAX_KEYWORDS);
}

/** Construit l'URL « voir plus » selon la catégorie dominante. */
function buildSeeMoreUrl(
  criteria: AssistantSearchCriteria,
  dominant: AssistantCategory,
): string {
  if (dominant === 'scholarship') return '/bourses';
  if (dominant === 'exam') return '/concours';

  // Emplois & stages : la page /jobs lit les paramètres q / city / contract.
  const params = new URLSearchParams();
  const keyword = cleanKeywords(criteria.keywords).join(' ');
  if (keyword) params.set('q', keyword);
  if (criteria.location) params.set('city', criteria.location);
  if (dominant === 'internship') params.set('contract', 'Stage');

  const qs = params.toString();
  return qs ? `/jobs?${qs}` : '/jobs';
}

function jobToResult(row: Awaited<ReturnType<typeof JobOfferSchemaService.list>>['rows'][number]): AssistantResult {
  const category: AssistantCategory =
    row.category === 'scholarship' ? 'scholarship' : row.category === 'internship' ? 'internship' : 'job';
  return {
    id: row.id,
    title: row.title,
    subtitle: row.company,
    location: row.location || 'Côte d\'Ivoire',
    meta: `${row.contract_type} · ${formatRelativeTime(row.created_at)}`,
    url: category === 'scholarship' ? `/bourses/${row.id}` : `/jobs/${row.id}`,
    category,
  };
}

function examToResult(exam: Awaited<ReturnType<typeof ExamService.list>>['rows'][number]): AssistantResult {
  const city = (exam.cities && exam.cities.length > 0 ? exam.cities[0] : exam.location) || '';
  return {
    id: exam.id,
    title: exam.title,
    subtitle: exam.organizer,
    location: city,
    meta: [
      exam.registration_end ? `Inscriptions jusqu'au ${exam.registration_end.slice(0, 10)}` : '',
      exam.positions_count ? `${exam.positions_count} postes` : '',
    ]
      .filter(Boolean)
      .join(' · '),
    url: examUrl(exam),
    category: 'exam',
  };
}

/**
 * Recherche dans la base selon les critères détectés.
 * Interroge les catégories demandées (ou toutes) en parallèle.
 */
export async function searchOpportunities(
  criteria: AssistantSearchCriteria,
): Promise<{ results: AssistantResult[]; total: number; dominant: AssistantCategory }> {
  const keyword = cleanKeywords(criteria.keywords).join(' ');
  const hasExams = criteria.categories.length === 0 || criteria.categories.includes('exam');
  const hasOffers =
    criteria.categories.length === 0 ||
    criteria.categories.some((c) => c === 'job' || c === 'internship' || c === 'scholarship');

  // Catégories « offres » à interroger (depuis job_offers).
  const offerCategories: Array<'job' | 'internship' | 'scholarship'> = (() => {
    if (criteria.categories.length === 0) return ['job', 'internship', 'scholarship'];
    const subset = criteria.categories.filter(
      (c): c is 'job' | 'internship' | 'scholarship' => c !== 'exam',
    );
    return subset.length > 0 ? subset : [];
  })();

  const [offersResult, examsResult] = await Promise.all([
    hasOffers && offerCategories.length > 0
      ? JobOfferSchemaService.list({
          category: offerCategories,
          keyword: keyword || undefined,
          location: criteria.location || undefined,
          status: 'published',
          is_archived: false,
          is_expired: false,
          limit: MAX_RESULTS * 2,
        })
      : Promise.resolve({ rows: [], total: 0 }),
    hasExams
      ? ExamService.list({
          keyword: keyword || undefined,
          status: 'published',
          limit: MAX_RESULTS * 2,
        })
      : Promise.resolve({ rows: [], total: 0 }),
  ]);

  const results: AssistantResult[] = [
    ...offersResult.rows.map(jobToResult),
    ...examsResult.rows.map(examToResult),
  ].slice(0, MAX_RESULTS);

  // Catégorie dominante : celle explicitement demandée en premier, sinon la
  // catégorie la plus représentée dans les résultats.
  const dominant: AssistantCategory =
    (criteria.categories[0] as AssistantCategory | undefined) ||
    results[0]?.category ||
    'job';

  return {
    results,
    total: offersResult.total + examsResult.total,
    dominant,
  };
}

/** URL « Voir plus de résultats » dérivée des critères. */
export function seeMoreUrlFor(
  criteria: AssistantSearchCriteria,
  dominant: AssistantCategory,
): string {
  return buildSeeMoreUrl(criteria, dominant);
}

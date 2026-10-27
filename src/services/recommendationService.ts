/**
 *  TravaillerEnCi — src/services/recommendationService.ts
 *
 *  Recommandations d'offres par candidat : combine le profil candidat
 *  (`candidate_profiles`) et les offres publiées (`job_offers`), puis classe
 *  via le moteur déterministe `src/lib/recommendationScoring.ts`.
 *
 *  • Aucune IA, aucun coût : scoring expliqué et reproductible.
 *  • Les offres déjà sauvegardées sont exclues (on recommande du nouveau).
 *  • Profil vide → repli « dernières offres publiées » (cold start), signalé
 *    par `isFallback: true` pour un message adapté côté UI.
 *
 *  La lecture du profil passe par `CandidateProfileService` (SQLite ou
 *  Supabase selon l'environnement) — aucune duplication de logique BDD.
 */

import 'server-only';
import type { JobOfferSchema } from '@/types';
import { getCachedJobVivier } from '@/lib/cachedJobVivier';
import { CandidateProfileService } from '@/services/candidateProfileService';
import { SavedItemsService } from '@/services/savedItemsService';
import {
  hasProfileSignals,
  rankJobs,
  type RecommendationProfile,
} from '@/lib/recommendationScoring';

/** Taille du vivier d'offres examiné avant classement. */
const CANDIDATE_POOL_SIZE = 300;

export interface RecommendedJob {
  job: JobOfferSchema;
  score: number;
  reasons: string[];
}

export interface RecommendationResult {
  jobs: RecommendedJob[];
  /** Nombre total d'offres éligibles (avant la limite d'affichage). */
  total: number;
  /** true = profil insuffisant → dernières offres publiées (pas de personnalisation). */
  isFallback: boolean;
  /** Indique si le profil contient des signaux exploitables. */
  profilePersonalized: boolean;
}

export class RecommendationService {
  /**
   * Retourne les offres recommandées pour un utilisateur.
   *
   * @param userId   Id de l'utilisateur connecté.
   * @param options  limit (défaut 6), excludeSaved (défaut true).
   */
  static async getForUser(
    userId: string,
    options: { limit?: number; excludeSaved?: boolean } = {},
  ): Promise<RecommendationResult> {
    const limit = Math.max(1, Math.min(options.limit ?? 6, 24));
    const excludeSaved = options.excludeSaved ?? true;

    const profile = await CandidateProfileService.get(userId);

    // Vivier partagé : offres + stages publiés et non expirés, les plus récents d'abord.
    const pool = (await getCachedJobVivier('both')).slice(0, CANDIDATE_POOL_SIZE);

    let candidates = pool;
    if (excludeSaved) {
      const saved = await SavedItemsService.list(userId);
      const savedKeys = new Set(saved.map((s) => `${s.item_type}:${s.item_id}`));
      candidates = pool.filter((job) => !savedKeys.has(`${savedItemType(job)}:${job.id}`));
    }

    const profileForScoring: RecommendationProfile = {
      city: profile?.city ?? null,
      diploma: profile?.diploma ?? null,
      sectors: profile?.sectors ?? [],
      contractTypes: profile?.contract_types ?? [],
      skills: profile?.skills ?? [],
      experienceLevel: profile?.experience_level ?? null,
    };

    const personalized = hasProfileSignals(profileForScoring);

    // Tri par score (profil vide → score nul partout → tri par date, cold start).
    const ranked = rankJobs(profileForScoring, candidates);

    return {
      jobs: ranked.slice(0, limit).map((r) => ({
        job: r.job,
        score: r.score,
        reasons: personalized ? r.reasons : [],
      })),
      total: candidates.length,
      isFallback: !personalized,
      profilePersonalized: personalized,
    };
  }
}

/** Type de sauvegarde correspondant à la catégorie de contenu d'une offre. */
function savedItemType(job: JobOfferSchema): 'job' | 'internship' | 'scholarship' | 'exam' {
  if (job.category === 'internship') return 'internship';
  if (job.category === 'scholarship') return 'scholarship';
  if (job.category === 'exam') return 'exam';
  return 'job';
}

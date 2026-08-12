import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { ExamService } from '@/services/examService';
import { examUrl } from '@/lib/examConstants';
import type { SavedItemType } from '@/services/savedItemsService';

/**
 *  TravaillerEnCi — src/lib/itemResolver.ts
 *  Résout un contenu référencé par (item_type, item_id) en métadonnées
 *  affichables (titre, sous-titre, lien) — utilisé par la liste des
 *  sauvegardes (/api/saved) et la file de modération des signalements
 *  (/api/admin/reports).
 *
 *  item_type : job | internship | scholarship → table job_offers
 *              exam                          → table exams
 *
 *  Retourne null si le contenu n'existe plus (supprimé / expiré).
 */
export interface ResolvedContentItem {
  item_type: SavedItemType;
  item_id: string;
  title: string;
  subtitle: string;
  url: string;
}

export async function resolveContentItem(
  itemType: SavedItemType,
  itemId: string,
): Promise<ResolvedContentItem | null> {
  if (itemType === 'exam') {
    const exam = await ExamService.getById(itemId);
    if (!exam) return null;
    return {
      item_type: itemType,
      item_id: itemId,
      title: exam.title,
      subtitle: exam.organizer,
      url: examUrl(exam),
    };
  }

  const job = await JobOfferSchemaService.getById(itemId);
  if (!job) return null;
  return {
    item_type: itemType,
    item_id: itemId,
    title: job.title,
    subtitle: `${job.company} — ${job.location}`,
    url:
      itemType === 'scholarship'
        ? `/bourses/${job.id}`
        : `/jobs/${job.id}`,
  };
}

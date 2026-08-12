import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { ExamService } from '@/services/examService';
import { notifyExamPublished } from '@/services/whatsappNotify';
import type { ExamCategory, ExamConfidence, ExamStatus, ExamType } from '@/types/exam';

const ALLOWED_CATEGORIES: ExamCategory[] = [
  'administratif',
  'sante',
  'enseignement',
  'securite',
  'militaire',
  'autre',
];
const ALLOWED_STATUSES: ExamStatus[] = ['pending', 'published', 'rejected', 'archived'];
const ALLOWED_TYPES: ExamType[] = [
  'recrutement_nouveau',
  'promotion',
  'concours_direct',
  'concours_professionnel',
  'entree_ecole',
  'examen',
];
const ALLOWED_CONFIDENCE: ExamConfidence[] = ['low', 'medium', 'high'];

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const organizer = typeof body.organizer === 'string' ? body.organizer.trim() : '';
    const description =
      typeof body.description_md === 'string' ? body.description_md.trim() : '';
    const status = (body.status as ExamStatus) || 'pending';

    if (!title || !organizer || !description) {
      return NextResponse.json(
        { error: 'Le titre, l’organisateur et la description sont obligatoires.' },
        { status: 400 },
      );
    }

    // Champ « source_url » OBLIGATOIRE avant publication (validation back).
    if (status === 'published') {
      const sourceUrl =
        typeof body.source_url === 'string' ? body.source_url.trim() : '';
      if (!sourceUrl) {
        return NextResponse.json(
          {
            error:
              'Le lien officiel (source_url) est obligatoire avant de publier un concours.',
          },
          { status: 400 },
        );
      }
    }

    if (status !== 'pending' && !ALLOWED_STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Statut invalide.' }, { status: 400 });
    }
    if (
      typeof body.category === 'string' &&
      !ALLOWED_CATEGORIES.includes(body.category as ExamCategory)
    ) {
      return NextResponse.json({ error: 'Catégorie invalide.' }, { status: 400 });
    }
    if (
      typeof body.exam_type === 'string' &&
      body.exam_type &&
      !ALLOWED_TYPES.includes(body.exam_type as ExamType)
    ) {
      return NextResponse.json({ error: 'Type de concours invalide.' }, { status: 400 });
    }
    if (
      typeof body.confidence === 'string' &&
      !ALLOWED_CONFIDENCE.includes(body.confidence as ExamConfidence)
    ) {
      return NextResponse.json({ error: 'Niveau de confiance invalide.' }, { status: 400 });
    }

    const created = await ExamService.create(body as any);
    if (!created) {
      return NextResponse.json(
        { error: 'Impossible de créer ce concours.' },
        { status: 500 },
      );
    }

    if (created.status === 'published') {
      await notifyExamPublished(created);
    }

    revalidatePath('/admin/exams');
    revalidatePath('/concours');
    // URL SEO (slug) — les URLs legacy par ID redirigent en 308 vers le slug.
    revalidatePath(`/concours/${created.slug || created.id}`);

    return NextResponse.json({ ok: true, exam: created }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/exams error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Impossible de créer ce concours.' },
      { status: 500 },
    );
  }
}

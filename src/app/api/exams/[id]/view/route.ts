import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ExamService } from '@/services/examService';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

/**
 * Incrément du compteur de vues d'un concours (appelé par le composant client
 * de la fiche détail — pas de rechargement de page).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // Anti-spam : évite le gonflement du compteur (fonction SECURITY DEFINER
  // côté base). 60 / 10 min par IP : largement au-dessus d'une session de
  // consultation, très en dessous d'un flood automatisé.
  if (isRateLimited(`exam-view:${getClientIp(request)}`, 60, 10 * 60 * 1000)) {
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez plus tard.' }, { status: 429 });
  }

  try {
    const exam = await ExamService.getById(id);
    if (!exam) {
      return NextResponse.json({ error: 'Concours introuvable.' }, { status: 404 });
    }
    await ExamService.incrementViews(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('POST /api/exams/[id]/view error:', err);
    return NextResponse.json(
      { error: 'Impossible de comptabiliser la visite.' },
      { status: 500 },
    );
  }
}

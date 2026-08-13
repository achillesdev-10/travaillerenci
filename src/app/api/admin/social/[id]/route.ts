/**
 *  TravaillerEnCi — /api/admin/social/[id]
 *  Actions admin sur une tâche sociale :
 *   preview  → génère l'aperçu (texte + image + URL + payload) sans publier
 *   publish  → publie maintenant (action explicite)
 *   schedule → reprogramme (scheduledAt ISO)
 *   ignore / cancel → statuts manuels
 *   retry    → réessaie une tâche échouée/ignorée
 *   edit     → modifie le texte
 *
 *  Protégé par la session admin. Jamais de secret dans les réponses.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import {
  editPostText,
  previewPost,
  publishNow,
  reschedulePost,
  retryPost,
  setPostStatus,
} from '@/services/social/socialQueueService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    scheduledAt?: string;
    text?: string;
    message?: string;
  } | null;

  const action = body?.action;
  if (!action) {
    return NextResponse.json({ error: 'Action manquante.' }, { status: 400 });
  }

  try {
    switch (action) {
      case 'preview': {
        const payload = await previewPost(id);
        if (!payload) return NextResponse.json({ error: 'Aperçu indisponible (contenu introuvable).' }, { status: 404 });
        return NextResponse.json({ ok: true, payload });
      }
      case 'publish': {
        const result = await publishNow(id);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case 'schedule': {
        if (typeof body.scheduledAt !== 'string' || Number.isNaN(new Date(body.scheduledAt).getTime())) {
          return NextResponse.json({ error: 'Date de programmation invalide.' }, { status: 400 });
        }
        const result = await reschedulePost(id, new Date(body.scheduledAt).toISOString());
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case 'ignore':
      case 'cancel': {
        const result = await setPostStatus(
          id,
          action === 'ignore' ? 'ignored' : 'cancelled',
          body.message,
        );
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case 'retry': {
        const result = await retryPost(id);
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      case 'edit': {
        const result = await editPostText(id, typeof body.text === 'string' ? body.text : '');
        if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
        return NextResponse.json({ ok: true });
      }
      default:
        return NextResponse.json({ error: 'Action inconnue.' }, { status: 400 });
    }
  } catch (error) {
    console.error('POST /api/admin/social/[id] error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur interne.' },
      { status: 500 },
    );
  }
}

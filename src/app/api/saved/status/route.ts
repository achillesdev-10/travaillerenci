import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { USER_SESSION_COOKIE } from '@/lib/sessionToken';
import {
  SavedItemsService,
  SAVED_ITEM_TYPES,
  type SavedItemType,
} from '@/services/savedItemsService';

export const runtime = 'nodejs';

/**
 * GET /api/saved/status?item_type=…&item_id=…
 * État de sauvegarde pour un élément (bouton étoile). Fonctionne aussi pour
 * les visiteurs non connectés → { saved: false }.
 */
export async function GET(request: NextRequest) {
  const itemType = request.nextUrl.searchParams.get('item_type') || '';
  const itemId = request.nextUrl.searchParams.get('item_id')?.trim() || '';

  if (!(SAVED_ITEM_TYPES as string[]).includes(itemType) || !itemId) {
    return NextResponse.json({ saved: false });
  }

  // Optimisation : sans cookie de session, pas de vérification en base — les
  // visiteurs anonymes (majorité sur les pages de listing) répondent en O(1).
  if (!request.cookies.get(USER_SESSION_COOKIE)?.value) {
    return NextResponse.json({ saved: false });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ saved: false });
  }

  const saved = await SavedItemsService.isSaved(user.id, itemType as SavedItemType, itemId);
  return NextResponse.json({ saved });
}

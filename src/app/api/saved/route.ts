import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import {
  SavedItemsService,
  SAVED_ITEM_TYPES,
  type SavedItemType,
} from '@/services/savedItemsService';
import { resolveContentItem } from '@/lib/itemResolver';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { ExamService } from '@/services/examService';

export const runtime = 'nodejs';

function isSavedItemType(value: string): value is SavedItemType {
  return (SAVED_ITEM_TYPES as string[]).includes(value);
}

export interface ResolvedSavedItem {
  item_type: SavedItemType;
  item_id: string;
  saved_at: string;
  title: string;
  subtitle: string;
  url: string;
}

/** GET /api/saved — liste les sauvegardes du candidat connecté (enrichies). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const saved = await SavedItemsService.list(user.id);
  const resolved = await Promise.all(
    saved.map((s) =>
      resolveContentItem(s.item_type, s.item_id).then((r) =>
        r ? { ...r, saved_at: s.created_at } : null,
      ),
    ),
  );

  const items: ResolvedSavedItem[] = [];
  const toPrune: Array<{ item_type: string; item_id: string }> = [];
  resolved.forEach((r, i) => {
    if (r) {
      items.push(r);
    } else {
      // Le contenu n'existe plus (supprimé/expiré) : on nettoie la sauvegarde
      // orpheline pour ne pas l'accumuler en base.
      toPrune.push({ item_type: saved[i].item_type, item_id: saved[i].item_id });
    }
  });
  if (toPrune.length > 0) {
    await Promise.all(
      toPrune.map((p) =>
        SavedItemsService.remove(user.id, p.item_type as SavedItemType, p.item_id),
      ),
    );
  }

  return NextResponse.json({ items });
}

/** POST /api/saved { item_type, item_id } — sauvegarde un élément. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const body = (await request.json()) as { item_type?: string; item_id?: string };
  const itemType = body.item_type || '';
  const itemId = (body.item_id || '').trim();

  if (!isSavedItemType(itemType) || !itemId) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }

  // On vérifie que l'élément existe avant de le sauvegarder (évite les ids bidons).
  const exists =
    itemType === 'exam'
      ? await ExamService.getById(itemId)
      : await JobOfferSchemaService.getById(itemId);
  if (!exists) {
    return NextResponse.json({ error: 'Élément introuvable.' }, { status: 404 });
  }

  const saved = await SavedItemsService.add(user.id, itemType, itemId);
  if (!saved) {
    return NextResponse.json(
      { error: "Impossible de sauvegarder pour le moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ saved: true, item: saved }, { status: 201 });
}

/** DELETE /api/saved?item_type=…&item_id=… — retire une sauvegarde. */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const itemType = request.nextUrl.searchParams.get('item_type') || '';
  const itemId = request.nextUrl.searchParams.get('item_id')?.trim() || '';

  if (!isSavedItemType(itemType) || !itemId) {
    return NextResponse.json({ error: 'Paramètres invalides.' }, { status: 400 });
  }

  await SavedItemsService.remove(user.id, itemType, itemId);
  return NextResponse.json({ saved: false });
}

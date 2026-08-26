import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { NotificationsService } from '@/services/notificationsService';

export const runtime = 'nodejs';

/** GET /api/notifications — liste les notifications récentes + compteur non-lues. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const [notifications, unreadCount] = await Promise.all([
    NotificationsService.list(user.id),
    NotificationsService.unreadCount(user.id),
  ]);

  return NextResponse.json({ notifications, unread_count: unreadCount });
}

/** PATCH /api/notifications { id } — marquer une notification comme lue. */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const body = (await request.json()) as { id?: string; mark_all?: boolean };

  if (body.mark_all) {
    await NotificationsService.markAllRead(user.id);
    return NextResponse.json({ success: true });
  }

  const notificationId = body.id?.trim();
  if (!notificationId) {
    return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 });
  }

  const updated = await NotificationsService.markRead(user.id, notificationId);
  if (!updated) {
    return NextResponse.json({ error: 'Notification introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/notifications?id=… — supprime une notification. */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const notificationId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!notificationId) {
    return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 });
  }

  const removed = await NotificationsService.remove(user.id, notificationId);
  return NextResponse.json({ removed });
}

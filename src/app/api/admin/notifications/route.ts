import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminSession";
import { AdminNotificationService } from "@/services/adminNotificationService";

/**
 * GET /api/admin/notifications
 *  — Récupère les notifications (avec ?unread=true pour non-lues uniquement).
 * POST /api/admin/notifications
 *  — Marque une notification comme lue (body: { id }) ou toutes (body: { all: true }).
 */

export async function GET(request: NextRequest) {
  const { error } = await requireAdminApi(request);
  if (error) return error;

  const url = new URL(request.url);
  const unreadOnly = url.searchParams.get("unread") === "true";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 30, 1), 100);

  const [notifications, unreadCount] = await Promise.all([
    AdminNotificationService.list({ unreadOnly, limit }),
    AdminNotificationService.unreadCount(),
  ]);

  return NextResponse.json({ notifications, unreadCount });
}

export async function POST(request: NextRequest) {
  const { error } = await requireAdminApi(request);
  if (error) return error;

  try {
    const body = await request.json();

    if (body.all === true) {
      const count = await AdminNotificationService.markAllAsRead();
      return NextResponse.json({ marked: count });
    }

    if (typeof body.id === "string" && body.id.trim()) {
      const ok = await AdminNotificationService.markAsRead(body.id.trim());
      return NextResponse.json({ marked: ok ? 1 : 0 });
    }

    return NextResponse.json({ error: "Paramètre 'id' ou 'all' requis." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}

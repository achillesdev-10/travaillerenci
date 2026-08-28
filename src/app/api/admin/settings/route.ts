import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { PlatformSettingsService } from '@/services/platformSettingsService';

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const settings = await PlatformSettingsService.getAll();
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error('GET /api/admin/settings error:', err);
    return NextResponse.json({ error: 'Impossible de charger les paramètres.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updates: Record<string, unknown> = {};

    // Validation partielle : on n'accepte que les clés connues
    const allowedKeys = [
      'sectors', 'cities', 'contract_types', 'budget_ranges',
      'scraper_sources', 'scraper_alert_threshold',
      'notification_channels',
    ];

    for (const key of allowedKeys) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun paramètre valide fourni.' }, { status: 400 });
    }

    const settings = await PlatformSettingsService.update(updates);
    return NextResponse.json({ ok: true, settings });
  } catch (err) {
    console.error('PATCH /api/admin/settings error:', err);
    return NextResponse.json({ error: 'Impossible de mettre à jour les paramètres.' }, { status: 500 });
  }
}

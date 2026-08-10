import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { AlertService } from '@/services/alertService';
import type { AlertCreateInput, AlertPatch } from '@/types/alerts';

export const runtime = 'nodejs';

/** GET /api/alerts — alertes du candidat connecté. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }
  const alerts = await AlertService.list(user.id);
  return NextResponse.json({ alerts });
}

/** POST /api/alerts — crée une alerte. */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const body = (await request.json()) as AlertCreateInput;
  if (!body.label?.trim()) {
    return NextResponse.json({ error: 'Donnez un nom à votre alerte.' }, { status: 400 });
  }

  const alert = await AlertService.create(user.id, {
    label: body.label,
    content_types: Array.isArray(body.content_types) ? body.content_types : [],
    city: typeof body.city === 'string' ? body.city : null,
    diploma: typeof body.diploma === 'string' ? body.diploma : null,
    sector: typeof body.sector === 'string' ? body.sector : null,
    channels: body.channels,
    frequency: body.frequency,
  });

  if (!alert) {
    return NextResponse.json(
      { error: "Impossible de créer l'alerte pour le moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ alert }, { status: 201 });
}

/** PATCH /api/alerts { id, …patch } — met à jour une alerte. */
export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const body = (await request.json()) as AlertPatch & { id?: string };
  const alertId = (body.id || '').trim();
  if (!alertId) {
    return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 });
  }

  // normalizePatch() ignore les clés inconnues (dont `id`) : on passe le body tel quel.
  const alert = await AlertService.update(user.id, alertId, body);
  if (!alert) {
    return NextResponse.json({ error: 'Alerte introuvable.' }, { status: 404 });
  }

  return NextResponse.json({ alert });
}

/** DELETE /api/alerts?id=… — supprime une alerte. */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const alertId = request.nextUrl.searchParams.get('id')?.trim() || '';
  if (!alertId) {
    return NextResponse.json({ error: 'Identifiant manquant.' }, { status: 400 });
  }

  const removed = await AlertService.remove(user.id, alertId);
  return NextResponse.json({ removed });
}

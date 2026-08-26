import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const { action, ids, data } = await request.json();

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: 'Aucun ID fourni.' }, { status: 400 });
    }

    if (action === 'delete') {
      await Promise.all(ids.map((id) => JobOfferSchemaService.remove(id)));
    } else if (action === 'clean') {
      // Nettoyage des descriptions (retire header/footer/publicités).
      await Promise.all(ids.map((id) => JobOfferSchemaService.cleanDescription(id)));
    } else if (action === 'update') {
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return NextResponse.json(
          { error: 'Les données de mise à jour sont invalides.' },
          { status: 400 },
        );
      }
      // Cohérence : publier une offre la marque automatiquement vérifiée.
      const patch: Record<string, unknown> = { ...data };
      if (patch.status === 'published' && typeof patch.is_verified !== 'boolean') {
        patch.is_verified = true;
      }
      await Promise.all(ids.map((id) => JobOfferSchemaService.update(id, patch)));
    } else {
      return NextResponse.json({ error: 'Action non reconnue.' }, { status: 400 });
    }

    revalidatePath('/achilles');
    revalidatePath('/achilles/jobs');
    revalidatePath('/');
    revalidatePath('/jobs');

    return NextResponse.json({ ok: true, count: ids.length });
  } catch (err) {
    console.error('Bulk action error:', err);
    const message = err instanceof Error ? err.message : '';
    if (/UNIQUE constraint|duplicate key/i.test(message)) {
      return NextResponse.json(
        { error: 'Conflit : même titre + entreprise sur une offre de la sélection.' },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: 'Erreur lors de l’action en masse.' }, { status: 500 });
  }
}

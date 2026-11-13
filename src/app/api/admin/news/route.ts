import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { normalizeNewsSettings } from '@/lib/news/config';
import { NewsRepository } from '@/lib/news/repository';
import type { NewsAutomationSettings } from '@/types/news';

export const dynamic = 'force-dynamic';

/** GET /api/admin/news — réglages, sources, statistiques et derniers runs. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  if (!NewsRepository.isAvailable()) {
    return NextResponse.json(
      { error: 'Supabase non configuré : réglages indisponibles.' },
      { status: 503 },
    );
  }

  try {
    const [settings, sources, stats, runs] = await Promise.all([
      NewsRepository.getSettings(),
      NewsRepository.listSources(),
      NewsRepository.stats(),
      NewsRepository.listRuns(8),
    ]);
    return NextResponse.json({ settings, sources, stats, runs });
  } catch (err) {
    console.error('GET /api/admin/news error:', err);
    return NextResponse.json({ error: 'Impossible de charger les réglages.' }, { status: 500 });
  }
}

/** PATCH /api/admin/news — met à jour les réglages ou une source. */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  if (!NewsRepository.isAvailable()) {
    return NextResponse.json(
      { error: 'Supabase non configuré : réglages indisponibles.' },
      { status: 503 },
    );
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.sourceId && typeof body.sourceId === 'string') {
      const sourcePatch =
        body.source && typeof body.source === 'object'
          ? (body.source as Record<string, unknown>)
          : {};
      const patch: Record<string, boolean | number> = {};
      if (typeof sourcePatch.enabled === 'boolean') patch.enabled = sourcePatch.enabled;
      if (typeof sourcePatch.allowed_for_citation === 'boolean') {
        patch.allowed_for_citation = sourcePatch.allowed_for_citation;
      }
      if (typeof sourcePatch.weight === 'number') {
        patch.weight = Math.min(10, Math.max(1, Math.round(sourcePatch.weight)));
      }
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Aucune modification de source.' }, { status: 400 });
      }
      const source = await NewsRepository.updateSource(body.sourceId, patch);
      if (!source) {
        return NextResponse.json({ error: 'Source introuvable.' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, source });
    }

    if (body.settings && typeof body.settings === 'object') {
      const current = await NewsRepository.getSettings();
      const settings: NewsAutomationSettings = normalizeNewsSettings({
        ...current,
        ...(body.settings as Partial<NewsAutomationSettings>),
      });
      const saved = await NewsRepository.saveSettings(settings);
      return NextResponse.json({ ok: true, settings: saved });
    }

    return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
  } catch (err) {
    console.error('PATCH /api/admin/news error:', err);
    return NextResponse.json({ error: 'Impossible d’enregistrer les réglages.' }, { status: 500 });
  }
}

import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { ExamService } from '@/services/examService';
import { notifyExamPublished } from '@/services/whatsappNotify';

function revalidateExamPages(exam: { id: string; slug?: string | null }) {
  revalidatePath('/admin/exams');
  revalidatePath('/concours');
  // URL SEO (slug) — les URLs legacy par ID redirigent en 308 vers le slug.
  revalidatePath(`/concours/${exam.slug || exam.id}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (Object.keys(body).length === 0) {
      return NextResponse.json(
        { error: 'Aucune modification valide n’a été fournie.' },
        { status: 400 },
      );
    }

    const existing = await ExamService.getById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Concours introuvable.' }, { status: 404 });
    }

    // Champ « source_url » OBLIGATOIRE avant publication (validation back).
    const nextStatus =
      typeof body.status === 'string' ? (body.status as string) : existing.status;
    const nextSourceUrl =
      typeof body.source_url === 'string'
        ? body.source_url.trim()
        : existing.source_url;
    if (nextStatus === 'published' && !nextSourceUrl) {
      return NextResponse.json(
        {
          error:
            'Le lien officiel (source_url) est obligatoire avant de publier ce concours.',
        },
        { status: 400 },
      );
    }

    const updated = await ExamService.update(id, body as any);
    if (!updated) {
      return NextResponse.json({ error: 'Concours introuvable.' }, { status: 404 });
    }

    // Notification WhatsApp si passage à « published » (service inactif tant
    // que WHATSAPP_NOTIFY_ENABLED n'est pas défini).
    if (updated.status === 'published' && existing.status !== 'published') {
      await notifyExamPublished(updated);
    }

    revalidateExamPages(updated);
    return NextResponse.json({ ok: true, exam: updated });
  } catch (err) {
    console.error('PATCH /api/admin/exams/[id] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Impossible de mettre à jour ce concours.' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const removed = await ExamService.remove(id);
    if (!removed) {
      return NextResponse.json({ error: 'Concours introuvable.' }, { status: 404 });
    }
    revalidateExamPages({ id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/admin/exams/[id] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Impossible de supprimer ce concours.' },
      { status: 500 },
    );
  }
}

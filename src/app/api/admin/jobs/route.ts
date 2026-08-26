import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import type { JobContractType, JobOfferSchemaInsert, JobOfferSchemaStatus } from '@/types';

import type { ContentCategory } from '@/types';

const ALLOWED_CONTRACTS: JobContractType[] = [
  'CDI',
  'CDD',
  'Stage',
  'Prestation',
  'Alternance',
  'Freelance',
];

const ALLOWED_CATEGORIES: ContentCategory[] = [
  'job',
  'internship',
  'scholarship',
  'exam',
];

const ALLOWED_STATUSES: JobOfferSchemaStatus[] = [
  'pending',
  'published',
  'rejected',
  'archived',
];

function normalizeInsert(body: Record<string, unknown>): Partial<JobOfferSchemaInsert> {
  const data: Record<string, any> = {};

  if (
    typeof body.category === 'string' &&
    ALLOWED_CATEGORIES.includes(body.category as ContentCategory)
  ) {
    data.category = body.category as ContentCategory;
  }

  if (typeof body.title === 'string' && body.title.trim()) data.title = body.title.trim();
  if (typeof body.company === 'string' && body.company.trim()) data.company = body.company.trim();
  if (typeof body.location === 'string' && body.location.trim()) data.location = body.location.trim();
  if (typeof body.description === 'string' && body.description.trim()) data.description = body.description.trim();

  if (typeof body.apply_link === 'string') {
    data.apply_link = body.apply_link.trim() ? body.apply_link.trim() : null;
  }
  if (typeof body.apply_email === 'string') {
    data.apply_email = body.apply_email.trim() ? body.apply_email.trim() : null;
  }
  if (typeof body.deadline === 'string') {
    data.deadline = body.deadline.trim() ? body.deadline.trim() : null;
  } else if (body.deadline === null) {
    data.deadline = null;
  }
  if (typeof body.source_url === 'string') data.source_url = body.source_url.trim() || null;
  if (typeof body.source_website === 'string') data.source_website = body.source_website.trim() || null;
  if (typeof body.seo_title === 'string') data.seo_title = body.seo_title.trim() || null;
  if (typeof body.seo_description === 'string') data.seo_description = body.seo_description.trim() || null;
  if (typeof body.seo_keywords === 'string') data.seo_keywords = body.seo_keywords.trim() || null;
  if (typeof body.slug === 'string') data.slug = body.slug.trim() || null;

  if (
    typeof body.contract_type === 'string' &&
    ALLOWED_CONTRACTS.includes(body.contract_type as JobContractType)
  ) {
    data.contract_type = body.contract_type as JobContractType;
  }

  if (
    typeof body.status === 'string' &&
    ALLOWED_STATUSES.includes(body.status as JobOfferSchemaStatus)
  ) {
    data.status = body.status as JobOfferSchemaStatus;
    if (data.status === 'published') data.is_verified = true;
  }

  return data;
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const data = normalizeInsert(body);

    if (!data.title || !data.company || !data.description) {
      return NextResponse.json(
        { error: 'Le titre, l’entreprise et la description sont obligatoires.' },
        { status: 400 }
      );
    }

    if (!data.apply_link && !data.apply_email) {
      data.apply_email = 'contact@travaillerenci.ci';
    }

    const created = await JobOfferSchemaService.create(data);
    if (!created) {
      return NextResponse.json(
        { error: 'Impossible de créer l’offre. Vérifiez que ce titre n’existe pas déjà pour cette entreprise.' },
        { status: 409 }
      );
    }

    revalidatePath('/achilles');
    revalidatePath('/achilles/jobs');
    revalidatePath('/');
    revalidatePath('/jobs');

    return NextResponse.json({ ok: true, job: created }, { status: 201 });
  } catch (err) {
    console.error('POST /api/admin/jobs error:', err);
    const message = err instanceof Error ? err.message : '';
    // SQLite lève une exception sur la contrainte UNIQUE (title, company) :
    // on la traduit en 409 pour un message clair côté admin.
    if (/UNIQUE constraint|duplicate key/i.test(message)) {
      return NextResponse.json(
        {
          error:
            'Cette offre existe déjà : même titre et même entreprise dans la base.',
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      {
        error: message || 'Impossible de créer cette offre.',
      },
      { status: 500 }
    );
  }
}

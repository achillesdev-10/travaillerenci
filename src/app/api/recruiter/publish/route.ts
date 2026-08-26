import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import type { JobContractType, JobOfferSchemaInsert } from '@/types';

const ALLOWED_CONTRACTS: JobContractType[] = [
  'CDI', 'CDD', 'Stage', 'Prestation', 'Alternance', 'Freelance',
];

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const company = typeof body.company === 'string' ? body.company.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const location = typeof body.location === 'string' ? body.location.trim() : '';
    const contractType = typeof body.contract_type === 'string' ? body.contract_type.trim() : '';
    const applyLink = typeof body.apply_link === 'string' ? body.apply_link.trim() : '';
    const applyEmail = typeof body.apply_email === 'string' ? body.apply_email.trim() : '';
    const contactName = typeof body.contact_name === 'string' ? body.contact_name.trim() : '';
    const contactPhone = typeof body.contact_phone === 'string' ? body.contact_phone.trim() : '';
    const deadline = typeof body.deadline === 'string' ? body.deadline.trim() : '';

    // Validation
    if (!title || title.length < 5) {
      return NextResponse.json({ error: 'Le titre doit contenir au moins 5 caractères.' }, { status: 400 });
    }
    if (!company) {
      return NextResponse.json({ error: 'Le nom de l\'entreprise est obligatoire.' }, { status: 400 });
    }
    if (!description || description.length < 20) {
      return NextResponse.json({ error: 'La description doit contenir au moins 20 caractères.' }, { status: 400 });
    }
    if (!location) {
      return NextResponse.json({ error: 'La localisation est obligatoire.' }, { status: 400 });
    }
    if (!contractType || !ALLOWED_CONTRACTS.includes(contractType as JobContractType)) {
      return NextResponse.json({ error: 'Type de contrat invalide.' }, { status: 400 });
    }
    if (!applyLink && !applyEmail) {
      return NextResponse.json(
        { error: 'Veuillez fournir un lien de candidature OU une adresse email.' },
        { status: 400 }
      );
    }

    const data: Partial<JobOfferSchemaInsert> = {
      title,
      company,
      description,
      location,
      contract_type: contractType as JobContractType,
      category: 'job',
      status: 'pending',
      is_verified: false,
      is_archived: false,
      is_expired: false,
      apply_link: applyLink || null,
      apply_email: applyEmail || null,
      deadline: deadline || null,
      seo_title: null,
      seo_description: null,
      seo_keywords: null,
      slug: null,
      source_url: null,
      source_website: 'recruiter-self-service',
    };

    const created = await JobOfferSchemaService.create(data as JobOfferSchemaInsert);
    if (!created) {
      return NextResponse.json(
        { error: 'Impossible de créer l\'offre. Vérifiez les informations saisies.' },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Votre offre a été soumise avec succès ! Elle sera publiée après validation par notre équipe.',
      job: created,
    }, { status: 201 });
  } catch (err) {
    console.error('POST /api/recruiter/publish error:', err);
    const message = err instanceof Error ? err.message : '';
    if (/UNIQUE constraint|duplicate key/i.test(message)) {
      return NextResponse.json(
        { error: 'Une offre similaire existe déjà (même titre et même entreprise).' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: message || 'Impossible de créer cette offre.' },
      { status: 500 }
    );
  }
}

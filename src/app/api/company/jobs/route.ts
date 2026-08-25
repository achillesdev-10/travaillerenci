/**
 *  TravaillerEnCi — /api/company/jobs
 *
 *  CRUD des offres d'emploi pour les entreprises connectées.
 *  • GET    — liste les offres de l'entreprise (authentification requise)
 *  • POST   — crée une nouvelle offre (source: 'direct', status: 'pending')
 *  • PATCH  — édite / clôture une offre (status: 'closed' ou update)
 *
 *  La company name est extraite de la session utilisateur (pas de champ
 *  "company" dans le formulaire : l'entreprise publie sous son propre nom).
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/userSession';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import type { JobOfferSchemaInsert, JobContractType } from '@/types';

export const runtime = 'nodejs';

// ---------------------------------------------------------------------------
// GET /api/company/jobs — liste les offres de l'entreprise connectée
// ---------------------------------------------------------------------------

export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== 'company') {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  // L'entreprise est identifiée par son nom dans la table job_offers.
  // On utilise la company name du champ `name` de la session.
  const companyName = session.name;

  const result = await JobOfferSchemaService.list({
    company: companyName,
    limit: 200,
    order_by: 'created_at',
    order_dir: 'desc',
  });

  return NextResponse.json({ offers: result.rows, total: result.total });
}

// ---------------------------------------------------------------------------
// POST /api/company/jobs — crée une nouvelle offre
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== 'company') {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const body = (await request.json()) as {
    title?: string;
    description?: string;
    location?: string;
    contract_type?: string;
    apply_link?: string;
    apply_email?: string;
    deadline?: string;
  };

  const title = body.title?.trim();
  const description = body.description?.trim();
  const location = body.location?.trim();
  const contractType = body.contract_type?.trim();

  if (!title) {
    return NextResponse.json({ error: 'Le titre du poste est obligatoire.' }, { status: 400 });
  }
  if (!description) {
    return NextResponse.json({ error: 'La description du poste est obligatoire.' }, { status: 400 });
  }
  if (!location) {
    return NextResponse.json({ error: 'La ville est obligatoire.' }, { status: 400 });
  }
  if (!contractType) {
    return NextResponse.json({ error: 'Le type de contrat est obligatoire.' }, { status: 400 });
  }

  const validContractTypes: JobContractType[] = ['CDI', 'CDD', 'Stage', 'Alternance', 'Freelance', 'Prestation'];
  if (!validContractTypes.includes(contractType as JobContractType)) {
    return NextResponse.json({ error: 'Type de contrat invalide.' }, { status: 400 });
  }

  // Au moins un moyen de postuler
  const applyLink = body.apply_link?.trim() || null;
  const applyEmail = body.apply_email?.trim() || null;
  if (!applyLink && !applyEmail) {
    return NextResponse.json(
      { error: 'Renseignez au moins un lien de candidature ou une adresse email.' },
      { status: 400 },
    );
  }

  const payload: Partial<JobOfferSchemaInsert> = {
    category: 'job',
    title,
    company: session.name,
    location,
    contract_type: contractType as JobContractType,
    description,
    apply_link: applyLink,
    apply_email: applyEmail,
    deadline: body.deadline?.trim() || null,
    // Offre directe : statut pending par défaut (modération admin avant publication).
    status: 'pending',
  };

  const offer = await JobOfferSchemaService.create(payload);
  if (!offer) {
    return NextResponse.json(
      { error: 'Impossible de créer l\'offre. Vérifiez que le titre n\'est pas déjà utilisé pour cette entreprise.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ offer }, { status: 201 });
}

// ---------------------------------------------------------------------------
// PATCH /api/company/jobs — édite ou clôture une offre
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== 'company') {
    return NextResponse.json({ error: 'Non autorisé.' }, { status: 401 });
  }

  const body = (await request.json()) as {
    id?: string;
    status?: string;
    title?: string;
    description?: string;
    location?: string;
    contract_type?: string;
    apply_link?: string;
    apply_email?: string;
    deadline?: string;
  };

  if (!body.id) {
    return NextResponse.json({ error: 'ID de l\'offre manquant.' }, { status: 400 });
  }

  // Vérifier que l'offre appartient bien à cette entreprise
  const existing = await JobOfferSchemaService.getById(body.id);
  if (!existing) {
    return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 });
  }
  if (existing.company !== session.name) {
    return NextResponse.json({ error: 'Non autorisé à modifier cette offre.' }, { status: 403 });
  }

  const patch: Partial<JobOfferSchemaInsert> = {};

  if (body.status === 'closed') {
    patch.status = 'archived';
    patch.is_archived = true;
  }

  if (body.title) patch.title = body.title.trim();
  if (body.description) patch.description = body.description.trim();
  if (body.location) patch.location = body.location.trim();
  if (body.contract_type) patch.contract_type = body.contract_type as JobContractType;
  if (body.apply_link !== undefined) patch.apply_link = body.apply_link?.trim() || null;
  if (body.apply_email !== undefined) patch.apply_email = body.apply_email?.trim() || null;
  if (body.deadline !== undefined) patch.deadline = body.deadline?.trim() || null;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucune modification fournie.' }, { status: 400 });
  }

  const updated = await JobOfferSchemaService.update(body.id, patch);
  if (!updated) {
    return NextResponse.json({ error: 'Erreur lors de la mise à jour.' }, { status: 500 });
  }

  return NextResponse.json({ offer: updated });
}

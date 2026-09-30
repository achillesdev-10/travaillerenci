import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { CandidateProfileService } from '@/services/candidateProfileService';

export const runtime = 'nodejs';

/**
 * GET /api/candidate/profile — profil du candidat connecté (ou { profile: null }).
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }
  const profile = await CandidateProfileService.get(user.id);
  return NextResponse.json({ profile });
}

/**
 * PUT /api/candidate/profile { city?, diploma?, sectors?, phone? }
 * Met à jour le mini-profil (champs optionnels, patch partiel).
 */
export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
  }

  const body = (await request.json()) as {
    city?: string;
    diploma?: string;
    sectors?: string[];
    phone?: string;
    job_title?: string;
    experience_level?: string;
    skills?: string[];
    contract_types?: string[];
    bio?: string;
    resume_url?: string;
  };

  // Les whitelists (secteurs, niveaux, contrats) sont appliquées dans
  // CandidateProfileService.upsert (source unique, commune avec l'inscription).
  const profile = await CandidateProfileService.upsert(user.id, {
    city: typeof body.city === 'string' ? body.city : undefined,
    diploma: typeof body.diploma === 'string' ? body.diploma : undefined,
    sectors: Array.isArray(body.sectors) ? body.sectors : undefined,
    phone: typeof body.phone === 'string' ? body.phone : undefined,
    job_title: typeof body.job_title === 'string' ? body.job_title : undefined,
    experience_level: typeof body.experience_level === 'string' ? body.experience_level : undefined,
    skills: Array.isArray(body.skills) ? body.skills : undefined,
    contract_types: Array.isArray(body.contract_types) ? body.contract_types : undefined,
    bio: typeof body.bio === 'string' ? body.bio : undefined,
    resume_url: typeof body.resume_url === 'string' ? body.resume_url : undefined,
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Impossible d'enregistrer le profil pour le moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile });
}

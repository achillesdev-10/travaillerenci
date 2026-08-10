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
  };

  // La whitelist des secteurs est appliquée dans CandidateProfileService.upsert
  // (source unique, commune avec l'inscription).
  const profile = await CandidateProfileService.upsert(user.id, {
    city: typeof body.city === 'string' ? body.city : undefined,
    diploma: typeof body.diploma === 'string' ? body.diploma : undefined,
    sectors: Array.isArray(body.sectors) ? body.sectors : undefined,
    phone: typeof body.phone === 'string' ? body.phone : undefined,
  });

  if (!profile) {
    return NextResponse.json(
      { error: "Impossible d'enregistrer le profil pour le moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ profile });
}

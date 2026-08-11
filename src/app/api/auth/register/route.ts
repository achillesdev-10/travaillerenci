import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { createUser } from '@/lib/userRepository';
import {
  attachUserSessionCookie,
  issueUserSessionToken,
} from '@/lib/userSession';
import { CandidateProfileService } from '@/services/candidateProfileService';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function POST(request: Request) {
  try {
    // Anti-spam : création de comptes limitée par adresse IP.
    if (isRateLimited(`register:${getClientIp(request)}`)) {
      return NextResponse.json(
        { error: 'Trop de créations de compte. Réessayez dans quelques minutes.' },
        { status: 429 },
      );
    }

    const body = (await request.json()) as {
      email?: string;
      name?: string;
      password?: string;
      role?: string;
      // Mini-profil optionnel (critères d'alertes) — renseigné par les candidats.
      city?: string;
      diploma?: string;
      sectors?: string[];
    };

    const email = body.email?.trim() || '';
    const name = body.name?.trim() || '';
    const password = body.password || '';
    const role = body.role === 'company' ? 'company' : 'candidate';

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Veuillez saisir une adresse email valide.' }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: 'Veuillez renseigner votre nom.' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères.' },
        { status: 400 },
      );
    }

    const user = await createUser({
      email,
      name,
      role,
      passwordHash: hashPassword(password),
      // Vérification d'email désactivée pour le moment : le compte est créé
      // directement vérifié. La livraison d'un email de confirmation exige un
      // domaine d'expéditeur vérifié chez Resend — indisponible tant que le
      // site tourne sur le domaine Vercel (voir docs/EMAIL_DELIVERY.md).
      emailVerified: true,
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Un compte existe déjà avec cette adresse email.' },
        { status: 409 },
      );
    }

    // Mini-profil candidat (optionnel) : ville / diplôme / secteurs d'intérêt,
    // servent aux alertes. Créé une seule fois, complétable depuis /dashboard.
    if (role === 'candidate' && (body.city || body.diploma || (body.sectors ?? []).length > 0)) {
      await CandidateProfileService.upsert(user.id, {
        city: body.city ?? null,
        diploma: body.diploma ?? null,
        sectors: body.sectors ?? [],
      });
    }

    // Session réelle : jeton HMAC signé dans un cookie httpOnly (30 jours).
    const token = await issueUserSessionToken(user);
    const response = NextResponse.json({ user }, { status: 201 });
    return attachUserSessionCookie(response, token);
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    return NextResponse.json(
      { error: 'Impossible de créer le compte pour le moment.' },
      { status: 500 },
    );
  }
}

import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import {
  createEmailVerificationToken,
  createUser,
} from '@/lib/userRepository';
import { sendVerificationEmail, getSiteUrl } from '@/lib/email';
import {
  attachUserSessionCookie,
  issueUserSessionToken,
} from '@/lib/userSession';
import { CandidateProfileService } from '@/services/candidateProfileService';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { isEmailVerificationEnabled } from '@/lib/config';

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

    // Vérification d'email : contrôlée par EMAIL_VERIFICATION_ENABLED.
    //  • désactivée (défaut) → compte créé directement vérifié, utilisable
    //    immédiatement, aucun appel à Resend (domaine Vercel actuel) ;
    //  • activée → compte créé non vérifié + email de confirmation envoyé
    //    (échec d'envoi NON bloquant : le compte reste utilisable).
    const emailVerificationEnabled = isEmailVerificationEnabled();

    const user = await createUser({
      email,
      name,
      role,
      passwordHash: hashPassword(password),
      emailVerified: !emailVerificationEnabled,
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

    // Vérification d'email ACTIVÉE : générer le jeton et envoyer le lien.
    // L'échec d'envoi (Resend non configuré, domaine de test…) ne bloque JAMAIS
    // la création : l'utilisateur garde un compte fonctionnel.
    if (emailVerificationEnabled) {
      try {
        const token = await createEmailVerificationToken(user.id);
        const verifyUrl = `${getSiteUrl()}/api/auth/verify-email?token=${token}`;
        await sendVerificationEmail(user.email, verifyUrl);
        console.log('[auth] email de confirmation envoyé à', user.email);
      } catch (err) {
        console.error('[auth] sendVerificationEmail error (non bloquant):', err);
      }
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

import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { createUser, createEmailVerificationToken } from '@/lib/userRepository';
import {
  attachUserSessionCookie,
  issueUserSessionToken,
} from '@/lib/userSession';
import { CandidateProfileService } from '@/services/candidateProfileService';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import { getSiteUrl, isEmailConfigured, sendVerificationEmail } from '@/lib/email';

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

    // Email de vérification : envoyé après inscription (non bloquant — le
    // compte est utilisable immédiatement, un bandeau invite à confirmer).
    // Le statut RÉEL de l'envoi est renvoyé au client : si l'email ne peut pas
    // partir (clé Resend absente, domaine d'expéditeur non vérifié…), le
    // candidat doit le savoir immédiatement au lieu de constater silencieusement
    // l'absence d'email (cause racine du « aucun email de confirmation reçu »).
    const emailStatus: { configured: boolean; sent: boolean; message?: string } = {
      configured: isEmailConfigured(),
      sent: false,
    };
    if (emailStatus.configured) {
      try {
        const token = await createEmailVerificationToken(user.id);
        const verifyUrl = `${getSiteUrl()}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
        await sendVerificationEmail(user.email, verifyUrl);
        emailStatus.sent = true;
      } catch (err) {
        // L'inscription ne doit JAMAIS échouer à cause de l'email de vérification.
        console.error('POST /api/auth/register sendVerificationEmail error:', err);
        emailStatus.message =
          "Échec de l'envoi de l'email de confirmation (détails dans les logs serveur).";
      }
    } else {
      // Cause classique du « aucun email reçu » : RESEND_API_KEY absent de
      // l'environnement. Journalisée BRUYAMMENT (warn) pour le diagnostic.
      console.warn(
        `[auth] ⚠️ RESEND_API_KEY absent : aucun email de confirmation envoyé à ${user.email} ` +
          "(configurer la variable dans l'environnement Vercel — voir docs/EMAIL_DELIVERY.md).",
      );
      emailStatus.message =
        "L'envoi d'emails n'est pas configuré sur cet environnement (clé Resend manquante).";
    }

    // Session réelle : jeton HMAC signé dans un cookie httpOnly (30 jours).
    const token = await issueUserSessionToken(user);
    const response = NextResponse.json({ user, email: emailStatus }, { status: 201 });
    return attachUserSessionCookie(response, token);
  } catch (err) {
    console.error('POST /api/auth/register error:', err);
    return NextResponse.json(
      { error: 'Impossible de créer le compte pour le moment.' },
      { status: 500 },
    );
  }
}

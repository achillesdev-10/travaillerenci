import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import {
  createEmailVerificationToken,
  deleteUserVerifyTokens,
} from '@/lib/userRepository';
import { getSiteUrl, isEmailConfigured, sendVerificationEmail } from '@/lib/email';
import { isRateLimited } from '@/lib/rateLimit';

export const runtime = 'nodejs';

/**
 * POST /api/auth/resend-verification — renvoie le lien de confirmation d'email
 * à l'utilisateur connecté dont l'email n'est pas encore vérifié.
 *
 *  • 401 si aucune session valide ;
 *  • 400 si l'email est déjà vérifié ;
 *  • 503 si le service d'envoi (Resend) n'est pas configuré — message clair ;
 *  • 429 si un lien a déjà été envoyé il y a moins d'une minute (anti-spam) ;
 *  • un nouvel EMAIL_VERIFY_TOKEN (24 h) est créé à chaque envoi — les anciens
 *    jetons non consommés restent valides (comportement identique aux autres
 *    flux de jetons du site).
 *
 * Routé hors du proxy (/api/auth/*) : la session est validée ici même.
 */
export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Vous devez être connecté pour renvoyer le lien de confirmation.' },
        { status: 401 },
      );
    }

    if (user.email_verified) {
      return NextResponse.json(
        { error: 'Votre adresse email est déjà vérifiée.' },
        { status: 400 },
      );
    }

    if (!isEmailConfigured()) {
      return NextResponse.json(
        {
          error:
            "Le service d'envoi d'emails n'est pas encore configuré sur le serveur. Contactez l'administrateur.",
        },
        { status: 503 },
      );
    }

    // Anti-spam : au plus 1 envoi / minute par utilisateur.
    if (isRateLimited(`resend-verify:${user.id}`, 1, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Un email vient d’être envoyé. Attendez une minute avant de renvoyer.' },
        { status: 429 },
      );
    }

    const token = await createEmailVerificationToken(user.id);
    const verifyUrl = `${getSiteUrl()}/api/auth/verify-email?token=${token}`;
    try {
      await sendVerificationEmail(user.email, verifyUrl);
    } catch (err) {
      console.error('sendVerificationEmail error:', err);
      // Échec d'envoi → jeton supprimé (pas de lien mort), même convention que
      // forgot-password.
      await deleteUserVerifyTokens(user.id).catch(() => undefined);
      return NextResponse.json(
        { error: 'Impossible d’envoyer le lien de confirmation. Veuillez réessayer.' },
        { status: 500 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Un nouveau lien de confirmation vient de vous être envoyé.',
    });
  } catch (err) {
    console.error('POST /api/auth/resend-verification error:', err);
    return NextResponse.json(
      { error: 'Impossible de renvoyer le lien pour le moment. Veuillez réessayer.' },
      { status: 500 },
    );
  }
}

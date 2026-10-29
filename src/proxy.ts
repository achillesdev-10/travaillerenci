import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  USER_SESSION_COOKIE,
  verifyAdminSessionToken,
  verifyUserSessionToken,
} from '@/lib/sessionToken';
import {
  SESSION_FLAG_COOKIE,
  SESSION_FLAG_COOKIE_OPTIONS,
  SESSION_FLAG_TTL_SECONDS,
} from '@/lib/sessionFlag';

/**
 *  TravaillerenCi — proxy.ts
 *
 *  Next.js 16 a renommé la convention `middleware.ts` (dépréciée) en `proxy.ts`.
 *
 *  Ce proxy valide la signature ET l'expiration du jeton de session admin :
 *  — Routes pages  /cz7tk/*     → redirect 307 vers /cz7tk/login
 *  — Routes API     /api/admin/*    → 401 JSON (les fetch clients gèrent 401)
 *  — Exception      /api/admin/session → laissé ouvert (login/logout)
 *  — Sessions        /dashboard/*    → 307 vers /login?next=… sans session
 *  — Déjà connecté   /login, /register, /reset-password (sans ?token=)
 *                    → 307 vers le dashboard (ou le ?next= sûr)
 *
 *  Le bypass « pas de vérification en dev » est supprimé : les routes admin
 *  sont toujours protégées, y compris en développement.
 *
 *  Perf CPU : il synchronise aussi le drapeau NON sensible `te_session`
 *  avec le cookie de session httpOnly (`travaillerenci_session`) — le client
 *  n'appelle /api/auth/me que si ce drapeau existe, cf. clientAuth.ts.
 *  La couverture des sessions posées avant l'introduction du drapeau est
 *  assurée au premier chargement de page ; le cookie httpOnly n'est jamais
 *  touché et aucune donnée utilisateur ne transite dans le drapeau.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Routes de session : login / logout — toujours ouvertes.
  if (pathname === '/api/admin/session') {
    return NextResponse.next();
  }

  // Drapeau client : la simple PRÉSENCE du cookie de session suffit (pas de
  // crypto ici) — le calcul coûteux des jetons n'est fait que pour les
  // surfaces qui en ont besoin (admin, dashboard, pages d'auth).
  const hasUserSessionCookie = Boolean(request.cookies.get(USER_SESSION_COOKIE)?.value);
  const hasSessionFlag = request.cookies.get(SESSION_FLAG_COOKIE)?.value === '1';
  const sessionFlagMismatch = hasUserSessionCookie !== hasSessionFlag;

  const token =
    request.cookies.get(ADMIN_SESSION_COOKIE)?.value ||
    request.cookies.get(LEGACY_ADMIN_SESSION_COOKIE)?.value;

  let hasValidSession = false;
  if (token) {
    try {
      hasValidSession = Boolean(await verifyAdminSessionToken(token));
    } catch {
      hasValidSession = false;
    }
  }

  // Session utilisateur (candidat / entreprise) : cookie httpOnly signé.
  const userToken = request.cookies.get(USER_SESSION_COOKIE)?.value;
  let userSession: Awaited<ReturnType<typeof verifyUserSessionToken>> = null;
  if (userToken) {
    try {
      userSession = await verifyUserSessionToken(userToken);
    } catch {
      userSession = null;
    }
  }
  const hasUserSession = Boolean(userSession);

  // 2. Routes API /api/admin/* : 401 JSON (les fetch clients gèrent le code).
  if (pathname.startsWith('/api/admin/')) {
    if (!hasValidSession) {
      return NextResponse.json(
        { error: 'Session administrateur invalide ou expirée.' },
        { status: 401 },
      );
    }
    return NextResponse.next();
  }

  // 3. Page de login : si déjà authentifié, direction le dashboard.
  if (pathname === '/cz7tk/login') {
    if (hasValidSession) {
      return NextResponse.redirect(new URL('/cz7tk', request.url));
    }
    return NextResponse.next();
  }

  // 4. Pages /cz7tk/* : redirect 307 vers /cz7tk/login.
  //    NB : on couvre aussi le chemin exact "/cz7tk" (le dashboard) —
  //    `startsWith("/cz7tk/")` seul laissait /cz7tk accessible sans session.
  if (pathname === '/cz7tk' || pathname.startsWith('/cz7tk/')) {
    if (!hasValidSession) {
      const loginUrl = new URL('/cz7tk/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 5. Espaces membres /dashboard/* : session utilisateur requise.
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    if (!hasUserSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 5b. Bon espace pour le bon rôle : un compte entreprise n'a rien à faire
  //     dans /dashboard/candidate (et inversement) — même connecté, l'utilisateur
  //     atterrit sur SON espace.
  if (pathname.startsWith('/dashboard/company') && userSession?.role === 'candidate') {
    return NextResponse.redirect(new URL('/dashboard/candidate', request.url));
  }
  if (pathname.startsWith('/dashboard/candidate') && userSession?.role === 'company') {
    return NextResponse.redirect(new URL('/dashboard/company', request.url));
  }

  // 6. Pages d'authentification : un utilisateur DÉJÀ connecté ne doit jamais
  //    revoir le formulaire de connexion ni celui d'inscription (retour arrière,
  //    lien « S'inscrire » cliqué alors que la session est active, cache client).
  if (pathname === '/login' || pathname === '/register' || pathname === '/reset-password') {
    if (userSession) {
      // Un lien de réinitialisation (?token=…) reste utilisable même connecté :
      // c'est le chemin légitime pour changer son propre mot de passe.
      const hasToken = request.nextUrl.searchParams.has('token');
      if (pathname === '/reset-password' && hasToken) {
        return NextResponse.next();
      }
      const destination = safeAuthAwareNext(
        request.nextUrl.searchParams.get('next'),
        userSession.role,
      );
      return NextResponse.redirect(new URL(destination, request.url));
    }
  }

  // 7. Synchronisation du drapeau client (uniquement si le couple
  //    cookie-session / drapeau est incohérent : cas courant, aucune
  //    surcharge ni Set-Cookie).
  const response = NextResponse.next();
  if (sessionFlagMismatch) {
    if (hasUserSessionCookie) {
      response.cookies.set(SESSION_FLAG_COOKIE, '1', {
        ...SESSION_FLAG_COOKIE_OPTIONS,
        maxAge: SESSION_FLAG_TTL_SECONDS,
      });
    } else {
      // Drapeau orphelin (session effacée par ailleurs) : on le retire pour
      // éviter un /api/auth/me inutile au prochain rendu.
      response.cookies.set(SESSION_FLAG_COOKIE, '', {
        ...SESSION_FLAG_COOKIE_OPTIONS,
        maxAge: 0,
      });
    }
  }
  return response;
}

/**
 * Destination après connexion/inscription : `?next=` si et seulement si c'est
 * un chemin interne sûr (anti open-redirect `//`, `\\` ou URL externe) et s'il
 * ne pointe pas vers une page d'authentification (sinon boucle de redirection).
 */
function safeAuthAwareNext(raw: string | null, role: string | undefined): string {
  const fallback = role === 'company' ? '/dashboard/company' : '/dashboard/candidate';
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) {
    return fallback;
  }
  if (/^\/(login|register|reset-password)(\/|\?|$)/.test(raw)) {
    return fallback;
  }
  if (raw.startsWith('/cz7tk')) return fallback; // session admin distincte
  return raw;
}

export const config = {
  matcher: [
    // Pages publiques (la majorité du trafic) : uniquement pour la
    // synchronisation du drapeau, ZÉRO crypto pour les visiteurs sans cookies.
    '/((?!api/|_next/static|_next/image|favicon|icons/|manifest\\.|sitemap\\.|robots\\.|sw\\.js).*)',
    // Surfaces protégées existantes : garde admin / dashboard / auth.
    '/cz7tk/:path*',
    '/api/admin/:path*',
    '/dashboard/:path*',
    '/login',
    '/register',
    '/reset-password',
  ],
};

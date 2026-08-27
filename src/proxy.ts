import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  LEGACY_ADMIN_SESSION_COOKIE,
  USER_SESSION_COOKIE,
  verifyAdminSessionToken,
  verifyUserSessionToken,
} from '@/lib/sessionToken';

/**
 *  TravaillerenCi — proxy.ts
 *
 *  Next.js 16 a renommé la convention `middleware.ts` (dépréciée) en `proxy.ts`.
 *
 *  Ce proxy valide la signature ET l'expiration du jeton de session admin :
 *  — Routes pages  /cz7tk/*     → redirect 307 vers /cz7tk/login
 *  — Routes API     /api/admin/*    → 401 JSON (les fetch clients gèrent 401)
 *  — Exception      /api/admin/session → laissé ouvert (login/logout)
 *
 *  Le bypass « pas de vérification en dev » est supprimé : les routes admin
 *  sont toujours protégées, y compris en développement.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Routes de session : login / logout — toujours ouvertes.
  if (pathname === '/api/admin/session') {
    return NextResponse.next();
  }

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
  let hasUserSession = false;
  if (userToken) {
    try {
      hasUserSession = Boolean(await verifyUserSessionToken(userToken));
    } catch {
      hasUserSession = false;
    }
  }

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

  return NextResponse.next();
}

export const config = {
  matcher: ['/cz7tk/:path*', '/api/admin/:path*', '/dashboard/:path*'],
};

import { NextResponse, type NextRequest } from 'next/server';
import {
  SESSION_FLAG_COOKIE,
  SESSION_FLAG_COOKIE_OPTIONS,
  SESSION_FLAG_TTL_SECONDS,
} from '@/lib/sessionFlag';
import { USER_SESSION_COOKIE } from '@/lib/sessionToken';

/**
 *  TravaillerEnCi — src/proxy.ts
 *
 *  Synchronisation du drapeau NON sensible `te_session` avec le cookie de
 *  session httpOnly `travaillerenci_session` — sur les chargements de page
 *  UNIQUEMENT (les /api valident leur session côté serveur et sont exclus).
 *
 *  Pourquoi : le client (Header, useAuth…) n'appelle plus /api/auth/me que si
 *  `te_session=1` est présent (perf CPU : zéro appel réseau pour les
 *  visiteurs anonymes). Une session posée AVANT le déploiement n'a pas
 *  encore ce drapeau : au premier chargement de page, la proxy le recrée —
 *  sans toucher au cookie httpOnly et sans jamais lire/modifier la session
 *  elle-même. Aucune donnée utilisateur ne transite par le drapeau.
 */

export const config = {
  matcher: [
    // Pages navigables : ni /api/* (session sécurité vérifiée en route),
    // ni assets Next, ni statiques (favicon, icons, sw, manifest, sitemap…).
    {
      source: '/((?!api/|_next/static|_next/image|favicon|icons/|manifest\\.|sitemap\\.|robots\\.|sw\\.js).*)',
    },
  ],
};

export function proxy(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(USER_SESSION_COOKIE)?.value);
  const hasFlag = request.cookies.get(SESSION_FLAG_COOKIE)?.value === '1';

  if (hasSession === hasFlag) {
    // Cas courant (cohérent) : aucun Set-Cookie, aucune surcharge.
    return NextResponse.next();
  }

  const response = NextResponse.next();
  if (hasSession) {
    // Couverture des sessions existantes (pré-déploiement) : on crée le drapeau.
    response.cookies.set(SESSION_FLAG_COOKIE, '1', {
      ...SESSION_FLAG_COOKIE_OPTIONS,
      maxAge: SESSION_FLAG_TTL_SECONDS,
    });
  } else {
    // Drapeau orphelin (session effacée autre part) : on le retire pour
    // éviter un /api/auth/me inutile au prochain rendu.
    response.cookies.set(SESSION_FLAG_COOKIE, '', {
      ...SESSION_FLAG_COOKIE_OPTIONS,
      maxAge: 0,
    });
  }
  return response;
}

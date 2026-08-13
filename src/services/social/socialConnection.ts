/**
 *  TravaillerEnCi — src/services/social/socialConnection.ts
 *  Diagnostic des connexions Facebook / LinkedIn pour le dashboard admin.
 *
 *  Aucun secret n'est renvoyé : uniquement l'état (connecté / non configuré /
 *  token expiré / erreur) et un message d'aide.
 */

import type { SocialConnectionStatus, SocialPlatform } from '@/types/social';
import { getFacebookConfig, getLinkedInConfig } from './config';
import { testFacebookConnection } from './providers/facebook';
import { testLinkedInConnection } from './providers/linkedin';

/** État « rapide » sans appel réseau (basé sur la présence des variables). */
export function getConnectionPresence(platform: SocialPlatform): {
  configured: boolean;
  missing: string[];
} {
  if (platform === 'facebook') {
    const cfg = getFacebookConfig();
    const missing: string[] = [];
    if (!cfg.pageId) missing.push('FACEBOOK_PAGE_ID');
    if (!cfg.accessToken) missing.push('FACEBOOK_ACCESS_TOKEN');
    return { configured: missing.length === 0, missing };
  }
  const cfg = getLinkedInConfig();
  const missing: string[] = [];
  if (!cfg.organizationId) missing.push('LINKEDIN_ORGANIZATION_ID');
  if (!cfg.accessToken) missing.push('LINKEDIN_ACCESS_TOKEN');
  return { configured: missing.length === 0, missing };
}

/**
 * Statut complet (avec test réseau si configuré).
 * Vérifie l'API réelle — jamais de token dans le résultat.
 */
export async function getConnectionsStatus(): Promise<SocialConnectionStatus[]> {
  const facebook = getConnectionPresence('facebook');
  const linkedin = getConnectionPresence('linkedin');

  const facebookStatus: SocialConnectionStatus = facebook.configured
    ? await (async () => {
        const test = await testFacebookConnection();
        if (test.ok) {
          return { platform: 'facebook', state: 'configured', label: 'Connecté', detail: test.detail };
        }
        if (test.state === 'expired') {
          return { platform: 'facebook', state: 'expired', label: 'Token expiré', detail: test.detail };
        }
        return { platform: 'facebook', state: 'error', label: 'Erreur', detail: test.detail };
      })()
    : {
        platform: 'facebook',
        state: 'not_configured',
        label: 'Non configuré',
        detail: `Variables manquantes : ${facebook.missing.join(', ')}.`,
      };

  const linkedinStatus: SocialConnectionStatus = linkedin.configured
    ? await (async () => {
        const test = await testLinkedInConnection();
        if (test.ok) {
          return { platform: 'linkedin', state: 'configured', label: 'Connecté', detail: test.detail };
        }
        if (test.state === 'expired') {
          return { platform: 'linkedin', state: 'expired', label: 'Token expiré', detail: test.detail };
        }
        return { platform: 'linkedin', state: 'error', label: 'Erreur', detail: test.detail };
      })()
    : {
        platform: 'linkedin',
        state: 'not_configured',
        label: 'Non configuré',
        detail:
          'Aucune Page Organisation LinkedIn renseignée. La destination actuelle (profil linkedin.com/in/…) n’est pas une Page. De plus, la publication automatique est actuellement FACEBOOK UNIQUEMENT — LinkedIn s’activera via SOCIAL_LINKEDIN_ENABLED=true une fois LINKEDIN_ORGANIZATION_ID + LINKEDIN_ACCESS_TOKEN configurés (permission w_organization_social).',
      };

  return [facebookStatus, linkedinStatus];
}

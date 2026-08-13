/**
 *  TravaillerEnCi — src/services/social/templates.ts
 *  Générateurs de textes DÉTERMINISTES pour Facebook et LinkedIn.
 *
 *  Règle absolue : chaque ligne n'est ajoutée que si le fait existe dans la
 *  publication TravaillerEnCi (voir facts.ts). Aucune donnée n'est inventée,
 *  reformulée, résumée ou complétée — uniquement mise en forme.
 */

import type { SocialPlatform } from '@/types/social';
import type { SocialContentFacts } from './facts';

// -----------------------------------------------------------------------------
//  En-têtes / hashtags par catégorie
// -----------------------------------------------------------------------------

const FACEBOOK_HEADERS: Record<string, string> = {
  job: '🔥 NOUVELLE OFFRE D\u2019EMPLOI',
  internship: '🔥 NOUVEAU STAGE',
  scholarship: '🎓 BOURSE D\u2019ÉTUDES',
  exam: '📢 CONCOURS / RECRUTEMENT',
};

const FACEBOOK_HASHTAGS: Record<string, string[]> = {
  job: ['EmploiCI', 'Recrutement', 'TravaillerEnCI'],
  internship: ['StageCI', 'Alternance', 'TravaillerEnCI'],
  scholarship: ['Bourse', 'Etudes', 'TravaillerEnCI'],
  exam: ['Concours', 'FonctionPublique', 'CoteDIvoire', 'TravaillerEnCI'],
};

const LINKEDIN_HEADERS: Record<string, string> = {
  job: 'OPPORTUNITÉ PROFESSIONNELLE',
  internship: 'OPPORTUNITÉ DE STAGE',
  scholarship: 'BOURSE D\u2019ÉTUDES',
  exam: 'CONCOURS / RECRUTEMENT',
};

const LINKEDIN_INTROS: Record<string, string> = {
  job: 'Une nouvelle opportunité professionnelle vient d\u2019être publiée sur TravaillerEnCi.',
  internship: 'Une nouvelle opportunité de stage vient d\u2019être publiée sur TravaillerEnCi.',
  scholarship: 'Une nouvelle bourse d\u2019études vient d\u2019être publiée sur TravaillerEnCi.',
  exam: 'Un nouveau concours / recrutement vient d\u2019être publié sur TravaillerEnCi.',
};

const LINKEDIN_HASHTAGS: Record<string, string[]> = {
  job: ['Emploi', 'CoteDIvoire', 'Recrutement'],
  internship: ['Stage', 'CoteDIvoire', 'Alternance'],
  scholarship: ['Bourse', 'Etudes', 'CoteDIvoire'],
  exam: ['Concours', 'CoteDIvoire', 'FonctionPublique'],
};

const CTA_FACEBOOK: Record<string, string> = {
  job: '👉 Voir l\u2019offre complète :',
  internship: '👉 Voir le stage complet :',
  scholarship: '👉 Voir la bourse complète :',
  exam: '👉 Voir le communiqué :',
};

// -----------------------------------------------------------------------------
//  Helpers
// -----------------------------------------------------------------------------

/** Ligne « icône + libellé » si le fait existe (jamais de ligne vide). */
function factLine(
  icon: string,
  label: string | null | undefined,
): string | null {
  if (!label || !String(label).trim()) return null;
  return `${icon} ${String(label).trim()}`;
}

function hashtags(list: string[], city: string | null): string {
  const tags = [...list];
  if (city) tags.push(city);
  return tags.map((t) => `#${t}`).join(' ');
}

function examFacts(facts: SocialContentFacts): string[] {
  const lines: string[] = [];
  const l1 = factLine('🏛️ Organisateur :', facts.company);
  if (l1) lines.push(l1);
  const l2 = factLine('📍 Localisation :', facts.location);
  if (l2) lines.push(l2);
  if (facts.diplomaLevels.length > 0) {
    lines.push(`🎓 Diplômes : ${facts.diplomaLevels.join(' / ')}`);
  }
  const l4 = factLine('📅 Clôture des inscriptions :', facts.deadlineLabel);
  if (l4) lines.push(l4);
  if (facts.positionsCount !== null && facts.positionsCount > 0) {
    lines.push(`👥 Nombre de places : ${facts.positionsCount}`);
  }
  const l6 = factLine('💰 Frais d\u2019inscription :', facts.registrationFee);
  if (l6) lines.push(l6);
  return lines;
}

function jobFacts(facts: SocialContentFacts): string[] {
  const lines: string[] = [];
  const l1 = factLine('📍 Localisation :', facts.location);
  if (l1) lines.push(l1);
  const l2 = factLine('💼 Type :', facts.contractType);
  if (l2) lines.push(l2);
  const l3 = factLine('🏢 Entreprise :', facts.company);
  if (l3) lines.push(l3);
  const l4 = factLine('📅 Date limite :', facts.deadlineLabel);
  if (l4) lines.push(l4);
  return lines;
}

// -----------------------------------------------------------------------------
//  Génération
// -----------------------------------------------------------------------------

export function buildFacebookText(
  facts: SocialContentFacts,
  url: string,
): string {
  const header = FACEBOOK_HEADERS[facts.type] || '📢 NOUVEAUTÉ';
  const body = facts.type === 'exam' ? examFacts(facts) : jobFacts(facts);
  const cta = CTA_FACEBOOK[facts.type] || '👉 Voir :';

  return [
    header,
    '',
    facts.title,
    '',
    ...body,
    '',
    'Découvrez les missions, le profil recherché et les modalités de candidature sur TravaillerEnCi.',
    '',
    `${cta}`,
    url,
    '',
    hashtags(FACEBOOK_HASHTAGS[facts.type] || ['TravaillerEnCI'], facts.city),
  ]
    .filter((line, index, arr) => line !== '' || arr[index - 1] !== '')
    .join('\n')
    .trim();
}

export function buildLinkedInText(
  facts: SocialContentFacts,
  url: string,
): string {
  const header = `${LINKEDIN_HEADERS[facts.type] || 'OPPORTUNITÉ'} — ${facts.title.toUpperCase()}`;
  const body = facts.type === 'exam' ? examFacts(facts) : jobFacts(facts);

  return [
    header,
    '',
    LINKEDIN_INTROS[facts.type] || '',
    '',
    ...body,
    '',
    'Retrouvez les missions, compétences recherchées et modalités de candidature sur TravaillerEnCi.',
    '',
    '👉 Consulter :',
    url,
    '',
    hashtags(LINKEDIN_HASHTAGS[facts.type] || ['CoteDIvoire'], null),
  ]
    .filter((line, index, arr) => line !== '' || arr[index - 1] !== '')
    .join('\n')
    .trim();
}

/** Dispatcher plateforme. */
export function buildSocialText(
  platform: SocialPlatform,
  facts: SocialContentFacts,
  url: string,
): string {
  return platform === 'linkedin'
    ? buildLinkedInText(facts, url)
    : buildFacebookText(facts, url);
}

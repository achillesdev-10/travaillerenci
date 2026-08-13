import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSocialSvg,
  getImageTemplate,
  svgToDataUri,
  wrapText,
  IMAGE_TEMPLATES,
} from '../../src/services/social/image';
import type { SocialContentFacts } from '../../src/services/social/facts';

function makeFacts(overrides: Partial<SocialContentFacts> = {}): SocialContentFacts {
  return {
    type: 'job',
    id: 'job-1',
    slug: null,
    title: 'Développeur Web',
    company: 'Orange CI',
    location: 'Abidjan, Plateau',
    city: 'Abidjan',
    contractType: 'CDI',
    deadline: '2026-09-15T00:00:00.000Z',
    deadlineLabel: '15 septembre 2026',
    diplomaLevels: [],
    positionsCount: null,
    registrationFee: null,
    description: 'Développer des applications web.',
    expired: false,
    ...overrides,
  };
}

test('un template d\'image par catégorie (EMPLOI/STAGE/CONCOURS/BOURSE)', () => {
  assert.deepEqual(
    IMAGE_TEMPLATES.map((t) => t.category),
    ['job', 'internship', 'scholarship', 'exam'],
  );
  assert.equal(getImageTemplate('job').label, "OFFRE D'EMPLOI");
  assert.equal(getImageTemplate('internship').label, 'STAGE');
  assert.equal(getImageTemplate('scholarship').label, "BOURSE D'ÉTUDES");
  assert.equal(getImageTemplate('exam').label, 'CONCOURS');
});

test('buildSocialSvg : titre, entreprise, faits et CTA présents', () => {
  const svg = buildSocialSvg(makeFacts());
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('Développeur Web'));
  assert.ok(svg.includes('ORANGE CI'));
  assert.ok(svg.includes('Abidjan'));
  assert.ok(svg.includes('CDI'));
  // Les apostrophes sont échappées en XML (&apos;) dans le SVG.
  assert.ok(svg.includes('OFFRE D') && svg.includes('EMPLOI'));
  assert.ok(svg.includes('VOIR L') && svg.includes('OFFRE'));
  assert.ok(svg.includes('TRAVAILLER'));
});

test('buildSocialSvg : concours — diplômes, places et frais réels', () => {
  const svg = buildSocialSvg(
    makeFacts({
      type: 'exam',
      title: 'Concours direct ENA',
      company: 'ENA',
      location: 'Abidjan',
      diplomaLevels: ['BAC', 'BTS/DUT'],
      positionsCount: 100,
      registrationFee: '10 000 FCFA',
    }),
  );
  assert.ok(svg.includes('CONCOURS'));
  assert.ok(svg.includes('BAC / BTS/DUT'));
  assert.ok(svg.includes("VOIR LE CONCOURS"));
});

test('données manquantes : lignes de faits omises (aucune invention)', () => {
  const svg = buildSocialSvg(
    makeFacts({ company: null, location: null, contractType: null, deadlineLabel: null }),
  );
  assert.ok(svg.includes('Développeur Web'));
  assert.ok(!svg.includes('ORANGE CI'));
});

test('wrapText : découpe sans couper de mot', () => {
  assert.deepEqual(wrapText('a b c', 3, 2), ['a b', 'c']);
  const lines = wrapText('Développeur Web Full Stack Senior chez Orange CI à Abidjan Plateau', 40, 2);
  assert.ok(lines.length <= 2);
  assert.ok(lines.join(' ').includes('Développeur'));
  // Texte trop long → troncature avec ellipsis sur la dernière ligne.
  const long = wrapText('a b c d e f g', 3, 2);
  assert.ok(long.length === 2);
  assert.ok(long[1]!.endsWith('…'));
});

test('svgToDataUri : data URI valide', () => {
  const uri = svgToDataUri('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
  assert.ok(uri.startsWith('data:image/svg+xml;base64,'));
});

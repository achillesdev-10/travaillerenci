import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFacebookText, buildLinkedInText } from '../../src/services/social/templates';
import type { SocialContentFacts } from '../../src/services/social/facts';

const URL = 'https://travaillerenci.vercel.app/jobs/job-1?utm_source=facebook&utm_medium=social&utm_campaign=job';

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

test('Facebook : offre complète — titre, faits, CTA, URL, hashtags', () => {
  const text = buildFacebookText(makeFacts(), URL);
  assert.ok(text.includes('Développeur Web'));
  assert.ok(text.includes('Abidjan, Plateau'));
  assert.ok(text.includes('CDI'));
  assert.ok(text.includes('Orange CI'));
  assert.ok(text.includes('15 septembre 2026'));
  assert.ok(text.includes('Voir l\u2019offre complète'));
  assert.ok(text.includes(URL));
  assert.ok(text.includes('#EmploiCI'));
  assert.ok(text.includes('#Abidjan'));
});

test('Facebook : données manquantes → lignes omises, jamais inventées', () => {
  const text = buildFacebookText(
    makeFacts({ company: null, contractType: null, deadlineLabel: null, location: null, city: null }),
    URL,
  );
  assert.ok(!text.includes('Entreprise :'));
  assert.ok(!text.includes('Type :'));
  assert.ok(!text.includes('Date limite :'));
  assert.ok(!text.includes('Localisation :'));
  assert.ok(text.includes('Développeur Web'));
});

test('Facebook : concours — places, diplômes, frais présents', () => {
  const text = buildFacebookText(
    makeFacts({
      type: 'exam',
      title: 'Concours direct ENA',
      company: 'ENA',
      location: 'Abidjan',
      diplomaLevels: ['BAC', 'BTS/DUT'],
      positionsCount: 100,
      registrationFee: '10 000 FCFA',
    }),
    URL,
  );
  assert.ok(text.includes('100'));
  assert.ok(text.includes('BAC / BTS/DUT'));
  assert.ok(text.includes('10 000 FCFA'));
  assert.ok(text.includes('#Concours'));
});

test('LinkedIn : ton professionnel, en-tête uppercase, moins d’emojis', () => {
  const text = buildLinkedInText(makeFacts(), URL);
  assert.ok(text.includes('OPPORTUNITÉ PROFESSIONNELLE — DÉVELOPPEUR WEB'));
  assert.ok(text.includes('Abidjan, Plateau'));
  assert.ok(text.includes('#Emploi'));
  assert.ok(text.includes('#CoteDIvoire'));
  assert.ok(text.includes(URL));
});

test('LinkedIn : concours — organisateur et diplômes', () => {
  const text = buildLinkedInText(
    makeFacts({
      type: 'exam',
      title: 'Concours direct ENA',
      company: 'ENA',
      diplomaLevels: ['BAC'],
      positionsCount: 50,
    }),
    URL,
  );
  assert.ok(text.includes('ENA'));
  assert.ok(text.includes('BAC'));
  assert.ok(text.includes('50'));
});

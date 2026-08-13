import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAiTextAgainstFacts } from '../../src/services/social/aiEnhancer';
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
    description: "Rémunération : 250 000 FCFA par mois. Expérience : 3 ans souhaitée.",
    expired: false,
    ...overrides,
  };
}

test('texte IA fidèle aux faits → accepté', () => {
  const text = `Nouvelle opportunité à Abidjan pour un CDI chez Orange CI. Rémunération de 250 000 FCFA, 3 ans d'expérience. ${URL}`;
  const res = validateAiTextAgainstFacts(text, makeFacts(), URL);
  assert.equal(res.valid, true, res.reason || '');
});

test('salaire inventé → rejeté', () => {
  const text = `Poste bien rémunéré : 500 000 FCFA par mois. ${URL}`;
  const res = validateAiTextAgainstFacts(text, makeFacts(), URL);
  assert.equal(res.valid, false);
  assert.ok((res.reason || '').includes('500'));
});

test('URL non autorisée → rejetée', () => {
  const text = `Voir l'offre ici : https://evil.example.com/phishing`;
  const res = validateAiTextAgainstFacts(text, makeFacts(), URL);
  assert.equal(res.valid, false);
});

test('type de contrat inventé → rejeté', () => {
  const text = `Contrat de type Freelance à pourvoir. ${URL}`;
  const res = validateAiTextAgainstFacts(text, makeFacts(), URL);
  assert.equal(res.valid, false);
});

test('date inventée → rejetée', () => {
  const text = `Candidatures jusqu'au 12 janvier 2030. ${URL}`;
  const res = validateAiTextAgainstFacts(text, makeFacts(), URL);
  assert.equal(res.valid, false);
});

test('diplôme inventé (concours) → rejeté', () => {
  const facts = makeFacts({
    type: 'exam',
    title: 'Concours direct ENA',
    diplomaLevels: ['BAC'],
    positionsCount: 100,
    registrationFee: '10 000 FCFA',
    description: 'Concours administratif ouvert.',
  });
  const ok = validateAiTextAgainstFacts(
    'Concours ouvert, niveau BAC. 100 places, 10 000 FCFA de frais.',
    facts,
    URL,
  );
  assert.equal(ok.valid, true, ok.reason || '');

  const bad = validateAiTextAgainstFacts(
    'Concours ouvert, niveau Master exigé.',
    facts,
    URL,
  );
  assert.equal(bad.valid, false);
});

test('les chiffres d\'un ID dans l\'URL ne déclenchent pas de faux rejet', () => {
  const facts = makeFacts({ id: 'abc-123' });
  const urlWithId = 'https://travaillerenci.vercel.app/jobs/abc-123?utm_source=facebook&utm_medium=social&utm_campaign=job';
  const text = `Offre CDI à Abidjan chez Orange CI. ${urlWithId}`;
  const res = validateAiTextAgainstFacts(text, facts, urlWithId);
  assert.equal(res.valid, true, res.reason || '');
});

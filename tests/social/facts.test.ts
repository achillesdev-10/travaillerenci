import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { JobOfferSchema } from '../../src/types';
import type { Exam } from '../../src/types/exam';
import { factsFromExam, factsFromJob } from '../../src/services/social/facts';

function makeJob(overrides: Partial<JobOfferSchema> = {}): JobOfferSchema {
  return {
    id: 'job-1',
    title: 'Développeur Web',
    company: 'Orange CI',
    location: 'Abidjan, Plateau',
    contract_type: 'CDI',
    description: '**Missions**\n\nDévelopper des applications.',
    apply_link: 'https://orange.ci/apply',
    apply_email: null,
    deadline: '2026-09-15T00:00:00.000Z',
    source_url: null,
    source_website: null,
    status: 'published',
    seo_title: null,
    seo_description: null,
    seo_keywords: null,
    slug: null,
    is_verified: true,
    is_archived: false,
    is_expired: false,
    category: 'job',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeExam(overrides: Partial<Exam> = {}): Exam {
  return {
    id: 'exam-1',
    title: 'Concours direct ENA',
    slug: 'concours-direct-ena',
    organizer: 'ENA',
    category: 'administratif',
    exam_type: 'concours_direct',
    status: 'published',
    description_md: 'Inscriptions ouvertes du 1er septembre au 15 octobre 2026.',
    registration_start: '2026-09-01T00:00:00.000Z',
    registration_end: '2026-10-15T00:00:00.000Z',
    exam_date: null,
    results_date: null,
    age_min: null,
    age_max: null,
    age_reference_date: null,
    nationality: null,
    diplomas: ['BAC', 'BTS/DUT'],
    min_diploma_level: 4,
    positions_count: 100,
    registration_fee: '10 000 FCFA',
    location: 'Abidjan',
    cities: ['Abidjan', 'Bouaké'],
    documents: [],
    source_url: 'https://ena.ci',
    source_website: 'ENA',
    confidence: 'high',
    views_count: 0,
    is_verified: true,
    seo_title: null,
    seo_description: null,
    seo_keywords: null,
    published_at: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

test('factsFromJob : extraction fidèle des données', () => {
  const facts = factsFromJob(makeJob());
  assert.equal(facts.type, 'job');
  assert.equal(facts.title, 'Développeur Web');
  assert.equal(facts.company, 'Orange CI');
  assert.equal(facts.location, 'Abidjan, Plateau');
  assert.equal(facts.city, 'Abidjan');
  assert.equal(facts.contractType, 'CDI');
  assert.equal(facts.deadline, '2026-09-15T00:00:00.000Z');
  assert.ok(facts.deadlineLabel && facts.deadlineLabel.includes('septembre'));
  assert.equal(facts.expired, false);
  assert.ok(facts.description && !facts.description.includes('**'));
});

test('factsFromJob : offre expirée détectée (is_expired ou deadline passée)', () => {
  assert.equal(factsFromJob(makeJob({ is_expired: true })).expired, true);
  assert.equal(factsFromJob(makeJob({ deadline: '2020-01-01T00:00:00.000Z' })).expired, true);
  assert.equal(factsFromJob(makeJob({ is_archived: true })).expired, true);
});

test('factsFromExam : diplômes, places, frais, échéance', () => {
  const facts = factsFromExam(makeExam());
  assert.equal(facts.type, 'exam');
  assert.equal(facts.company, 'ENA');
  assert.deepEqual(facts.diplomaLevels, ['BAC', 'BTS/DUT']);
  assert.equal(facts.positionsCount, 100);
  assert.equal(facts.registrationFee, '10 000 FCFA');
  assert.equal(facts.deadline, '2026-10-15T00:00:00.000Z');
  assert.equal(facts.expired, false);
});

test('factsFromExam : concours clos (inscriptions et épreuves passées) → expiré', () => {
  const facts = factsFromExam(
    makeExam({
      registration_start: '2026-01-01T00:00:00.000Z',
      registration_end: '2026-02-01T00:00:00.000Z',
      exam_date: '2026-03-01T00:00:00.000Z',
    }),
  );
  assert.equal(facts.expired, true);
});

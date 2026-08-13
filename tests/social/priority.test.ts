import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePriority, daysUntil } from '../../src/services/social/priority';

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

test('catégorie : concours/bourses priorité élevée, emplois/stages normale', () => {
  const exam = computePriority({ contentType: 'exam' });
  const scholarship = computePriority({ contentType: 'scholarship' });
  const job = computePriority({ contentType: 'job' });
  const internship = computePriority({ contentType: 'internship' });

  assert.ok(exam > job, 'exam > job');
  assert.ok(scholarship > internship, 'scholarship > internship');
  assert.ok(job < 60 && job >= 40, 'job dans la plage normale');
  assert.ok(internship < 60 && internship >= 40, 'internship dans la plage normale');
});

test('échéance proche augmente la priorité', () => {
  const near = computePriority({ contentType: 'job', deadline: inDays(2) });
  const far = computePriority({ contentType: 'job', deadline: inDays(30) });
  const none = computePriority({ contentType: 'job', deadline: null });
  assert.ok(near > far, 'échéance à 2j > échéance à 30j');
  assert.ok(far >= none, 'échéance lointaine ≥ pas d’échéance');
});

test('complétude augmente la priorité', () => {
  const bare = computePriority({ contentType: 'job' });
  const rich = computePriority({
    contentType: 'job',
    hasCompany: true,
    hasLocation: true,
    hasContractType: true,
    hasDescription: true,
    hasApplyMethod: true,
    hasDeadline: true,
  });
  assert.ok(rich > bare, 'offre complète > offre minimale');
});

test('score borné entre 0 et 100', () => {
  const max = computePriority({
    contentType: 'exam',
    deadline: inDays(1),
    hasCompany: true,
    hasLocation: true,
    hasContractType: true,
    hasDescription: true,
    hasApplyMethod: true,
    hasDeadline: true,
  });
  assert.ok(max <= 100 && max >= 0);
});

test('daysUntil : null si date absente ou invalide', () => {
  assert.equal(daysUntil(null), null);
  assert.equal(daysUntil('pas-une-date'), null);
  const d = daysUntil(inDays(3));
  assert.ok(d !== null && d <= 3 && d >= 2);
});

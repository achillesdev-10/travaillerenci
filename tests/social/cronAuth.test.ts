import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCronAuthorized, isCronEnabled, safeEqual } from '../../src/lib/cronAuth';

const saved = { CRON_SECRET: process.env.CRON_SECRET };

function makeRequest(authHeader?: string) {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? authHeader ?? null : null),
    },
  } as Parameters<typeof isCronAuthorized>[0];
}

test('requête sans secret → refusée', () => {
  process.env.CRON_SECRET = 'mon-secret-long';
  assert.equal(isCronAuthorized(makeRequest(undefined)), false);
  assert.equal(isCronAuthorized(makeRequest('Basic abc')), false);
});

test('requête avec le bon Bearer → autorisée', () => {
  process.env.CRON_SECRET = 'mon-secret-long';
  assert.equal(isCronAuthorized(makeRequest('Bearer mon-secret-long')), true);
});

test('requête avec un mauvais secret → refusée', () => {
  process.env.CRON_SECRET = 'mon-secret-long';
  assert.equal(isCronAuthorized(makeRequest('Bearer mauvais-secret')), false);
});

test('CRON_SECRET absent → tout est refusé (sécurité par défaut)', () => {
  delete process.env.CRON_SECRET;
  assert.equal(isCronEnabled(), false);
  assert.equal(isCronAuthorized(makeRequest('Bearer nimporte')), false);
});

test('safeEqual : comparaison à temps constant, longueurs différentes rejetées', () => {
  assert.equal(safeEqual('abc', 'abc'), true);
  assert.equal(safeEqual('abc', 'abd'), false);
  assert.equal(safeEqual('abc', 'abcd'), false);
  assert.equal(safeEqual('', ''), true);
});

test('restaure l\'environnement', () => {
  if (saved.CRON_SECRET === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = saved.CRON_SECRET;
});

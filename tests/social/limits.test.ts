import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  nextPublishTimes,
  nextSlotAfter,
  remainingQuota,
  retryBackoffMinutes,
  slotTimesForDay,
} from '../../src/services/social/limits';

const SLOTS = ['09:00', '11:30', '14:00', '16:30', '18:30'];

test('remainingQuota : jamais négatif', () => {
  assert.equal(remainingQuota(2, 5), 3);
  assert.equal(remainingQuota(7, 5), 0);
  assert.equal(remainingQuota(0, 5), 5);
});

test('nextSlotAfter : créneau du jour après now, sinon demain', () => {
  const now = new Date('2026-08-13T10:00:00');
  const next = nextSlotAfter(now, SLOTS)!;
  assert.equal(next.getHours(), 11);
  assert.equal(next.getMinutes(), 30);

  const late = new Date('2026-08-13T20:00:00');
  const nextDay = nextSlotAfter(late, SLOTS)!;
  assert.equal(nextDay.getDate(), late.getDate() + 1);
  assert.equal(nextDay.getHours(), 9);
});

test('slotTimesForDay : horaires exacts', () => {
  const day = new Date('2026-08-13T00:00:00');
  const times = slotTimesForDay(day, ['09:00', '11:30']);
  assert.equal(times[0].getHours(), 9);
  assert.equal(times[1].getHours(), 11);
  assert.equal(times[1].getMinutes(), 30);
});

test('nextPublishTimes : répartit dans la journée sans dépasser le quota', () => {
  const now = new Date('2026-08-13T10:00:00');
  // usedToday=1, limit=2 → 1 créneau restant aujourd'hui, puis demain.
  const times = nextPublishTimes(1, 2, SLOTS, now, 3);
  assert.equal(times.length, 3);
  assert.equal(times[0].getHours(), 11);
  assert.equal(times[0].getMinutes(), 30);
  assert.equal(times[1].getDate(), now.getDate() + 1, 'reporté au lendemain');
  assert.equal(times[1].getHours(), 9);
  assert.equal(times[2].getHours(), 11);
  assert.equal(times[2].getMinutes(), 30);
});

test('nextPublishTimes : quota atteint → tout reporté demain', () => {
  const now = new Date('2026-08-13T10:00:00');
  const times = nextPublishTimes(2, 2, ['09:00', '11:30'], now, 2);
  assert.equal(times.length, 2);
  assert.equal(times[0].getDate(), now.getDate() + 1);
  assert.equal(times[1].getDate(), now.getDate() + 1);
});

test('nextPublishTimes : 20 contenus ne sont pas publiés d’un coup', () => {
  const now = new Date('2026-08-13T10:00:00');
  const times = nextPublishTimes(0, 5, SLOTS, now, 20);
  // Aujourd'hui : créneaux après 10h dans la limite de 5 → 11:30, 14:00, 16:30, 18:30 (4).
  assert.equal(times.length, 20);
  const sameDay = times.filter((t) => t.getDate() === now.getDate());
  assert.equal(sameDay.length, 4);
  // Puis 5/jour les jours suivants (répartition progressive).
  assert.equal(times[4].getDate(), now.getDate() + 1);
  assert.equal(times[9].getDate(), now.getDate() + 2);
});

test('retryBackoffMinutes : 1 → 5 → 30 (puis 30)', () => {
  assert.equal(retryBackoffMinutes(1), 1);
  assert.equal(retryBackoffMinutes(2), 5);
  assert.equal(retryBackoffMinutes(3), 30);
  assert.equal(retryBackoffMinutes(5), 30);
});

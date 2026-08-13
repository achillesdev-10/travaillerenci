import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import type { JobOfferSchema } from '../../src/types';
import {
  openSocialDatabase,
  createSocialPostRepo,
  __setTestRepo,
  type SocialPostRepo,
} from '../../src/services/social/socialPostService';
import {
  __setContentResolver,
  enqueueForContent,
  processDue,
  publishNow,
  retryPost,
  scheduleQueued,
  setPostStatus,
} from '../../src/services/social/socialQueueService';
import { factsFromJob } from '../../src/services/social/facts';

// -----------------------------------------------------------------------------
//  Helpers d'environnement
// -----------------------------------------------------------------------------

const ENV_KEYS = [
  'FACEBOOK_PAGE_ID',
  'FACEBOOK_ACCESS_TOKEN',
  'LINKEDIN_ORGANIZATION_ID',
  'LINKEDIN_ACCESS_TOKEN',
  'SOCIAL_DRY_RUN',
  'SOCIAL_FACEBOOK_DAILY_LIMIT',
  'SOCIAL_LINKEDIN_DAILY_LIMIT',
  'SOCIAL_LINKEDIN_ENABLED',
  'SOCIAL_MAX_RETRIES',
  'SOCIAL_PUBLISH_SLOTS',
  'SOCIAL_AI_ENABLED',
  'GEMINI_API_KEY',
  'GROQ_API_KEY',
  'NEXT_PUBLIC_DB_PROVIDER',
] as const;

const savedEnv: Record<string, string | undefined> = {};

function setEnv(obj: Record<string, string | undefined>) {
  for (const key of Object.keys(obj) as Array<keyof typeof obj>) {
    savedEnv[key] = process.env[key];
    if (obj[key] === undefined) delete process.env[key];
    else process.env[key] = obj[key]!;
  }
}

function resetEnv() {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
}

function restoreEnv() {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key]!;
  }
}

function makeJob(overrides: Partial<JobOfferSchema> = {}): JobOfferSchema {
  return {
    id: 'job-1',
    title: 'Développeur Web',
    company: 'Orange CI',
    location: 'Abidjan, Plateau',
    contract_type: 'CDI',
    description: 'Développer des applications web.',
    apply_link: 'https://orange.ci/apply',
    apply_email: null,
    deadline: null,
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

const YESTERDAY = new Date(Date.now() - 86400000).toISOString();
const TOMORROW = new Date(Date.now() + 86400000).toISOString();

let repo: SocialPostRepo;

beforeEach(async () => {
  resetEnv();
  const db = await openSocialDatabase(':memory:');
  repo = createSocialPostRepo(db);
  __setTestRepo(repo);
  __setContentResolver(null);
});

afterEach(() => {
  __setTestRepo(null);
  __setContentResolver(null);
  restoreEnv();
});

// -----------------------------------------------------------------------------
//  Tests
// -----------------------------------------------------------------------------

test('création d’une tâche + déduplication (contrainte UNIQUE)', async () => {
  const created = await repo.create({
    content_type: 'job',
    content_id: 'job-1',
    content_title: 'Développeur Web',
    platform: 'facebook',
    status: 'queued',
    priority: 50,
  });
  assert.ok(created);

  // Même contenu + même plateforme → doublon refusé.
  const dup = await repo.create({
    content_type: 'job',
    content_id: 'job-1',
    content_title: 'Développeur Web',
    platform: 'facebook',
    status: 'queued',
  });
  assert.equal(dup, null);

  // Autre plateforme → autorisé.
  const linkedin = await repo.create({
    content_type: 'job',
    content_id: 'job-1',
    platform: 'linkedin',
    status: 'queued',
  });
  assert.ok(linkedin);
  assert.equal((await repo.findForContent('job', 'job-1', 'facebook'))?.id, created.id);
});

test('réclamation atomique : une seule instance gagne (idempotence)', async () => {
  const post = await repo.create({
    content_type: 'job',
    content_id: 'job-1',
    platform: 'facebook',
    status: 'scheduled',
    scheduled_at: YESTERDAY,
  });
  const claimed1 = await repo.claim(post!.id);
  assert.equal(claimed1?.status, 'publishing');
  const claimed2 = await repo.claim(post!.id);
  assert.equal(claimed2, null, 'la seconde réclamation doit échouer');
});

test('comptage des publications utilisées aujourd’hui', async () => {
  const now = new Date().toISOString();
  const a = await repo.create({ content_type: 'job', content_id: 'a', platform: 'facebook', status: 'published' });
  await repo.update(a!.id, { published_at: now });
  await repo.create({ content_type: 'job', content_id: 'b', platform: 'facebook', status: 'scheduled', scheduled_at: now });
  await repo.create({ content_type: 'job', content_id: 'c', platform: 'facebook', status: 'scheduled', scheduled_at: TOMORROW });
  const used = await repo.countPlatformUsedToday('facebook', now);
  assert.equal(used, 2);
});

test('enqueueForContent : Facebook par défaut, LinkedIn seulement si activé', async () => {
  setEnv({
    FACEBOOK_PAGE_ID: '123',
    FACEBOOK_ACCESS_TOKEN: 'tok',
    LINKEDIN_ORGANIZATION_ID: '42',
    LINKEDIN_ACCESS_TOKEN: 'tok',
    SOCIAL_LINKEDIN_ENABLED: undefined,
  });

  const facts = factsFromJob(makeJob());
  const n = await enqueueForContent(repo, facts);
  assert.equal(n, 1, 'Facebook seul — LinkedIn exclu de la publication automatique par défaut');

  const again = await enqueueForContent(repo, facts);
  assert.equal(again, 0, 'déjà enfilé → aucun doublon');

  const expired = factsFromJob(makeJob({ is_expired: true }));
  const nExpired = await enqueueForContent(repo, expired);
  assert.equal(nExpired, 0, 'contenu expiré → jamais enfilé');

  // LinkedIn explicitement réactivé → tâche LinkedIn créée en plus.
  setEnv({ SOCIAL_LINKEDIN_ENABLED: 'true' });
  const nLinkedin = await enqueueForContent(repo, facts);
  assert.equal(nLinkedin, 1);
});

test('scheduleQueued : créneaux progressifs + limite quotidienne', async () => {
  setEnv({
    FACEBOOK_PAGE_ID: '123',
    FACEBOOK_ACCESS_TOKEN: 'tok',
    SOCIAL_FACEBOOK_DAILY_LIMIT: '1',
    SOCIAL_PUBLISH_SLOTS: '09:00,11:30,14:00',
    LINKEDIN_ORGANIZATION_ID: undefined,
    LINKEDIN_ACCESS_TOKEN: undefined,
  });

  const low = await repo.create({ content_type: 'job', content_id: 'j-low', platform: 'facebook', status: 'queued', priority: 10 });
  const high = await repo.create({ content_type: 'job', content_id: 'j-high', platform: 'facebook', status: 'queued', priority: 90 });

  const now = new Date('2026-08-13T10:00:00');
  const scheduled = await scheduleQueued(now);
  assert.equal(scheduled, 2);

  const afterHigh = await repo.getById(high!.id);
  const afterLow = await repo.getById(low!.id);
  // La priorité la plus haute prend le créneau le plus proche (11:30).
  assert.equal(afterHigh!.status, 'scheduled');
  assert.equal(new Date(afterHigh!.scheduled_at!).getHours(), 11);
  // Quota (1) atteint → la seconde est reportée au lendemain 09:00.
  assert.equal(afterLow!.status, 'scheduled');
  assert.equal(new Date(afterLow!.scheduled_at!).getDate(), now.getDate() + 1);
  assert.equal(new Date(afterLow!.scheduled_at!).getHours(), 9);
});

test('processDue : publication dry-run + idempotence (jamais de republication)', async () => {
  setEnv({
    FACEBOOK_PAGE_ID: '123',
    FACEBOOK_ACCESS_TOKEN: 'tok',
    SOCIAL_DRY_RUN: 'true',
    SOCIAL_FACEBOOK_DAILY_LIMIT: '5',
    SOCIAL_PUBLISH_SLOTS: '09:00',
    LINKEDIN_ORGANIZATION_ID: undefined,
    LINKEDIN_ACCESS_TOKEN: undefined,
  });
  __setContentResolver(async (_type, id) => makeJob({ id }));

  const post = await repo.create({
    content_type: 'job',
    content_id: 'job-1',
    content_title: 'Développeur Web',
    platform: 'facebook',
    status: 'scheduled',
    scheduled_at: YESTERDAY,
  });

  const res = await processDue(new Date('2026-08-13T10:00:00'));
  assert.equal(res.processed, 1);
  assert.equal(res.published, 1);

  const after = await repo.getById(post!.id);
  assert.equal(after!.status, 'published');
  assert.equal(after!.dry_run, true);
  assert.equal(after!.external_post_id, 'dry-run');
  assert.ok(after!.text!.includes('Développeur Web'));
  assert.ok(after!.link_url!.includes('utm_source=facebook'));

  // Deuxième exécution du worker → rien à faire (anti-doublon).
  const res2 = await processDue(new Date('2026-08-13T10:30:00'));
  assert.equal(res2.processed, 0);
  assert.equal(res2.published, 0);
});

test('processDue : erreur API → retry avec backoff puis échec définitif', async () => {
  setEnv({
    FACEBOOK_PAGE_ID: '123',
    FACEBOOK_ACCESS_TOKEN: 'tok',
    SOCIAL_DRY_RUN: 'false',
    SOCIAL_MAX_RETRIES: '2',
    SOCIAL_PUBLISH_SLOTS: '09:00',
    LINKEDIN_ORGANIZATION_ID: undefined,
    LINKEDIN_ACCESS_TOKEN: undefined,
  });
  __setContentResolver(async () => makeJob());

  const failingProviders = {
    facebook: async () => {
      throw new Error('L\u2019API Facebook a renvoyé une erreur 500');
    },
    linkedin: async () => {
      throw new Error('should not be called');
    },
  };

  const post = await repo.create({
    content_type: 'job',
    content_id: 'job-1',
    platform: 'facebook',
    status: 'scheduled',
    scheduled_at: YESTERDAY,
  });

  // Tentative 1 → échec → re-programmée avec backoff (1 min).
  const res1 = await processDue(new Date('2026-08-13T10:00:00'), failingProviders);
  assert.equal(res1.processed, 1);
  let after = await repo.getById(post!.id);
  assert.equal(after!.status, 'scheduled');
  assert.equal(after!.attempt_count, 1);
  assert.ok(after!.next_attempt_at, 'next_attempt_at défini');
  assert.ok(after!.error_message!.includes('500'));

  // Retry pas encore dû (next_attempt_at futur) → rien.
  const resNotDue = await processDue(new Date('2026-08-13T10:00:30'), failingProviders);
  assert.equal(resNotDue.processed, 0);

  // On force l'échéance du retry (dans l'horloge simulée) → tentative 2 →
  // échec définitif (maxRetries=2).
  await repo.update(post!.id, { next_attempt_at: '2026-08-13T10:01:30.000Z' });
  const res2 = await processDue(new Date('2026-08-13T10:02:00'), failingProviders);
  assert.equal(res2.processed, 1);
  assert.equal(res2.failed, 1);
  after = await repo.getById(post!.id);
  assert.equal(after!.status, 'failed');
  assert.equal(after!.attempt_count, 2);
});

test('processDue : contenu introuvable → ignored (aucun envoi)', async () => {
  setEnv({
    FACEBOOK_PAGE_ID: '123',
    FACEBOOK_ACCESS_TOKEN: 'tok',
    SOCIAL_DRY_RUN: 'false',
    LINKEDIN_ORGANIZATION_ID: undefined,
    LINKEDIN_ACCESS_TOKEN: undefined,
  });
  __setContentResolver(async () => null);

  const post = await repo.create({
    content_type: 'job',
    content_id: 'supprime',
    platform: 'facebook',
    status: 'scheduled',
    scheduled_at: YESTERDAY,
  });
  await processDue(new Date('2026-08-13T10:00:00'));
  const after = await repo.getById(post!.id);
  assert.equal(after!.status, 'ignored');
  assert.equal(after!.error_code, 'CONTENT_MISSING');
});

test('publishNow : publication immédiate + refus de double publication', async () => {
  setEnv({
    FACEBOOK_PAGE_ID: '123',
    FACEBOOK_ACCESS_TOKEN: 'tok',
    SOCIAL_DRY_RUN: 'true',
    LINKEDIN_ORGANIZATION_ID: undefined,
    LINKEDIN_ACCESS_TOKEN: undefined,
  });
  __setContentResolver(async () => makeJob());

  const post = await repo.create({
    content_type: 'job',
    content_id: 'job-1',
    platform: 'facebook',
    status: 'queued',
  });

  const r1 = await publishNow(post!.id);
  assert.equal(r1.ok, true);
  assert.equal((await repo.getById(post!.id))!.status, 'published');

  const r2 = await publishNow(post!.id);
  assert.equal(r2.ok, false, 'déjà publiée → refusé');
});

test('actions admin : réessayer / ignorer / annuler', async () => {
  const failed = await repo.create({ content_type: 'job', content_id: 'f1', platform: 'facebook', status: 'failed' });
  if (failed) await repo.update(failed.id, { error_message: 'boom' });
  const ignored = await repo.create({ content_type: 'job', content_id: 'i1', platform: 'facebook', status: 'ignored' });
  const queued = await repo.create({ content_type: 'job', content_id: 'q1', platform: 'facebook', status: 'queued' });

  const retried = await retryPost(failed!.id);
  assert.equal(retried.ok, true);
  assert.equal((await repo.getById(failed!.id))!.status, 'queued');
  assert.equal((await repo.getById(failed!.id))!.attempt_count, 0);

  const ig = await setPostStatus(queued!.id, 'ignored', 'hors sujet');
  assert.equal(ig.ok, true);
  assert.equal((await repo.getById(queued!.id))!.status, 'ignored');

  const cancel = await setPostStatus(ignored!.id, 'cancelled');
  assert.equal(cancel.ok, true);
  assert.equal((await repo.getById(ignored!.id))!.status, 'cancelled');

  // Une tâche publiée ne peut pas être ignorée.
  const published = await repo.create({ content_type: 'job', content_id: 'p1', platform: 'facebook', status: 'published' });
  const onPublished = await setPostStatus(published!.id, 'ignored');
  assert.equal(onPublished.ok, false);
});

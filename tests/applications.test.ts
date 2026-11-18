/**
 * Sprint 1 — carnet de candidatures externes.
 * Run with:
 *   node --require ./scripts/__stubs/server-only-stub.cjs --import tsx tests/applications.test.ts
 *
 * Couvre les 11 scénarios du sprint + garde-fous d'API (session, rôle, offre
 * fermée/invalide, doublon, isolation entre utilisateurs, migration absente).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  buildApplyReturnPath,
  buildJobPath,
  buildMailtoHref,
  isCoverLetterTooLong,
  isOfferOpen,
  normalizeCoverLetter,
  normalizeHttpUrl,
  normalizeResumeUrl,
  resolveApplyMethod,
  safeInternalPath,
} from '../src/lib/applicationRules';
import {
  ApplicationService,
  __resetApplicationServiceForTests,
  __test as applicationTest,
} from '../src/services/applicationService';
import { createApplicationsHandlers } from '../src/app/api/applications/route';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, message: string) {
  if (condition) {
    passed++;
    process.stdout.write('.');
  } else {
    failed++;
    failures.push(message);
    process.stdout.write('F');
  }
}

function assertEqual<T>(actual: T, expected: T, testName: string) {
  assert(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${testName}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

const tempDir = mkdtempSync(join(tmpdir(), 'travaillerenci-applications-'));
const dbPath = join(tempDir, 'test.sqlite3');
process.env.NEXT_PUBLIC_DB_PROVIDER = 'sqlite';
process.env.TRAVAILLERENCI_DB_PATH = dbPath;

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const JOB_A = '33333333-3333-4333-8333-333333333333';
const JOB_B = '44444444-4444-4444-8444-444444444444';

function seedDatabase() {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'candidate',
      password_hash TEXT NOT NULL DEFAULT 'x',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE job_offers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      slug TEXT,
      apply_link TEXT,
      apply_email TEXT,
      status TEXT NOT NULL DEFAULT 'published',
      is_expired INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      deadline TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    INSERT INTO users (id, email, name, role) VALUES
      ('${USER_A}', 'a@example.ci', 'Awa', 'candidate'),
      ('${USER_B}', 'b@example.ci', 'Bakary', 'candidate');
    INSERT INTO job_offers (id, title, company, slug, apply_link, apply_email, status) VALUES
      ('${JOB_A}', 'Développeur web', 'Acme CI', 'developpeur-web', 'https://acme.ci/postuler', 'rh@acme.ci', 'published'),
      ('${JOB_B}', 'Comptable', 'Beta SARL', 'comptable', 'https://beta.ci/jobs', NULL, 'published');
  `);
  db.close();
}

function session(role: 'candidate' | 'company' = 'candidate', userId = USER_A) {
  return {
    userId,
    email: userId === USER_B ? 'b@example.ci' : 'a@example.ci',
    name: userId === USER_B ? 'B' : 'A',
    role,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: JOB_A,
    title: 'Développeur web',
    company: 'Acme CI',
    apply_link: 'https://acme.ci/postuler',
    apply_email: 'rh@acme.ci',
    status: 'published',
    is_expired: false,
    is_archived: false,
    deadline: null,
    ...overrides,
  };
}

async function main() {
  console.log('\nRunning applications (carnet) tests...\n');
  seedDatabase();

  // 1. Offre publiée et active.
  console.log('1. Disponibilité de l’offre');
  assert(isOfferOpen(job()), 'offre publiée active = ouverte');
  assert(!isOfferOpen(job({ is_expired: true })), 'offre marquée expirée = fermée');
  assert(!isOfferOpen(job({ is_archived: true })), 'offre archivée = fermée');
  assert(!isOfferOpen(job({ status: 'pending' })), 'offre non publiée = fermée');
  assert(
    !isOfferOpen(job({ deadline: '2020-01-01' }), new Date('2024-01-01T12:00:00Z')),
    'date limite dépassée = fermée',
  );
  assert(
    isOfferOpen(job({ deadline: '2024-01-01' }), new Date('2024-01-01T23:30:00Z')),
    'date seule valable jusqu’à la fin de journée',
  );

  // 2. Méthode de candidature.
  console.log('\n2. Méthode de candidature');
  assertEqual(resolveApplyMethod(job(), null), 'external', 'lien prioritaire');
  assertEqual(resolveApplyMethod(job(), 'email'), 'email', 'email demandé et disponible');
  assertEqual(
    resolveApplyMethod(job({ apply_link: 'javascript:alert(1)' }), 'external'),
    'email',
    'lien non http(s) ignoré au profit de l’email',
  );
  assertEqual(
    resolveApplyMethod(job({ apply_link: null, apply_email: null }), null),
    null,
    'aucun canal = null',
  );

  // 3. Validation des entrées.
  console.log('\n3. Validation');
  assert(normalizeResumeUrl('https://example.ci/cv.pdf') !== null, 'CV https accepté');
  assertEqual(normalizeResumeUrl('javascript:alert(1)'), null, 'CV javascript refusé');
  assertEqual(normalizeResumeUrl('ftp://example.ci/cv.pdf'), null, 'CV ftp refusé');
  assertEqual(normalizeHttpUrl('https://example.ci/offre'), 'https://example.ci/offre', 'URL http(s) normalisée');
  assertEqual(normalizeCoverLetter('  Bonjour  '), 'Bonjour', 'lettre trimmée');
  assertEqual(normalizeCoverLetter('   '), null, 'lettre vide = null');
  assert(isCoverLetterTooLong('x'.repeat(5001)), 'lettre > 5000 refusée');
  assert(!isCoverLetterTooLong('x'.repeat(5000)), 'lettre = 5000 acceptée');

  // 4. Chemins sûrs.
  console.log('\n4. Chemins internes');
  assertEqual(buildJobPath('abc'), '/jobs/abc', 'chemin offre');
  assertEqual(buildApplyReturnPath('abc'), '/jobs/abc?postuler=1', 'retour panneau');
  assertEqual(safeInternalPath('/jobs/abc?postuler=1', '/'), '/jobs/abc?postuler=1', 'next interne conservé');
  assertEqual(safeInternalPath('//evil.example', '/safe'), '/safe', 'next protocol-relative refusé');
  assertEqual(safeInternalPath('https://evil.example', '/safe'), '/safe', 'next externe refusé');
  assertEqual(safeInternalPath('/\\evil', '/safe'), '/safe', 'backslash refusé');
  assert(
    buildMailtoHref('rh@acme.ci', 'Développeur', 'Acme').startsWith('mailto:rh@acme.ci?subject='),
    'mailto avec sujet',
  );

  // 5. Enregistrement + lecture du carnet.
  console.log('\n5. Enregistrement / lecture');
  const created = await ApplicationService.record({
    userId: USER_A,
    jobId: JOB_A,
    applyMethod: 'external',
    resumeUrl: 'https://example.ci/cv.pdf',
    coverLetter: 'Bonjour',
  });
  assert(created.ok, 'candidature enregistrée');
  if (!created.ok) throw new Error('record failed');
  assertEqual(created.data.status, 'to_finalize', 'statut initial = to_finalize');
  assertEqual(created.data.apply_method, 'external', 'méthode enregistrée');
  assertEqual(created.data.job_title, 'Développeur web', 'jointure offre (titre)');
  assertEqual(created.data.company, 'Acme CI', 'jointure offre (entreprise)');

  const listA = await ApplicationService.listForUser(USER_A);
  assert(listA.ok && listA.data.length === 1, 'carnet de A contient 1 candidature');

  // 6. Doublon.
  console.log('\n6. Anti-doublon');
  const duplicate = await ApplicationService.record({
    userId: USER_A,
    jobId: JOB_A,
    applyMethod: 'external',
  });
  assert(!duplicate.ok && duplicate.reason === 'duplicate', 'doublon refusé');

  // 7. Isolation entre utilisateurs.
  console.log('\n7. Isolation');
  const listB = await ApplicationService.listForUser(USER_B);
  assert(listB.ok && listB.data.length === 0, 'carnet de B vide');
  const foreignUpdate = await ApplicationService.updateStatusForUser(
    created.data.id,
    USER_B,
    'sent',
  );
  assert(
    !foreignUpdate.ok && foreignUpdate.reason === 'not_found',
    'B ne peut pas modifier la candidature de A',
  );

  // 8. Mise à jour du suivi.
  console.log('\n8. Suivi du statut');
  const sent = await ApplicationService.updateStatusForUser(created.data.id, USER_A, 'sent');
  assert(sent.ok && sent.data.status === 'sent', 'passage à sent');
  assert(sent.ok && sent.changed === true, 'premier passage à sent = changement réel');
  const sentAgain = await ApplicationService.updateStatusForUser(created.data.id, USER_A, 'sent');
  assert(
    sentAgain.ok && sentAgain.changed === false,
    'statut déjà posé = aucun changement (pas de double événement)',
  );
  const response = await ApplicationService.updateStatusForUser(
    created.data.id,
    USER_A,
    'response_received',
  );
  assert(response.ok && response.data.status === 'response_received', 'passage à response_received');
  const closed = await ApplicationService.updateStatusForUser(created.data.id, USER_A, 'closed');
  assert(closed.ok && closed.data.status === 'closed', 'passage à closed');
  const invalid = await ApplicationService.updateStatusForUser(
    created.data.id,
    USER_A,
    'shortlisted',
  );
  assert(!invalid.ok, 'statut entreprise refusé côté candidat');

  // 9. Mapping Supabase (sans credentials) + détection migration absente.
  console.log('\n9. Contrat Supabase');
  const mapped = applicationTest.mapSupabaseRow({
    id: 'x',
    job_id: JOB_A,
    user_id: USER_A,
    status: 'sent',
    apply_method: 'email',
    applied_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    job_offers: { title: 'T', company: 'C', slug: 's', apply_link: null, apply_email: 'a@b.ci' },
  });
  assertEqual(mapped.job_title, 'T', 'mapping Supabase du titre');
  assertEqual(mapped.apply_method, 'email', 'mapping Supabase de la méthode');
  assert(
    applicationTest.isMissingSchemaError({ code: '42703', message: 'column user_id does not exist' }),
    'migration absente détectée',
  );
  assert(
    applicationTest.isDuplicateError({ code: '23505', message: 'duplicate key' }),
    'doublon Supabase détecté',
  );

  // 10. API : session / rôle / offre / doublon.
  console.log('\n10. Garde-fous API');
  const baseDeps = {
    getClientIp: () => '127.0.0.1',
    isRateLimited: () => false,
    now: () => new Date('2026-01-01T12:00:00Z'),
    recordEvent: async () => true,
    getProfile: async () => null,
  };

  const anon = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => null,
    getJob: async () => null,
    record: async () => ({ ok: false, reason: 'db_error' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: false, reason: 'not_found' }),
  });
  const anonRes = await anon.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A }),
    }),
  );
  assertEqual(anonRes.status, 401, 'POST sans session = 401');

  const company = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('company'),
    getJob: async () => job() as never,
    record: async () => ({ ok: false, reason: 'db_error' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: false, reason: 'not_found' }),
  });
  const companyGet = await company.GET(new Request('http://localhost/api/applications'));
  assertEqual(companyGet.status, 403, 'GET entreprise = 403 explicite');

  const expired = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('candidate'),
    getJob: async () => job({ is_expired: true }) as never,
    record: async () => ({ ok: false, reason: 'db_error' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: false, reason: 'not_found' }),
  });
  const expiredRes = await expired.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A }),
    }),
  );
  assertEqual(expiredRes.status, 409, 'offre expirée = 409');

  const duplicateHandler = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('candidate'),
    getJob: async () => job() as never,
    record: async () => ({ ok: false, reason: 'duplicate' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: false, reason: 'not_found' }),
  });
  const duplicateRes = await duplicateHandler.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A }),
    }),
  );
  assertEqual(duplicateRes.status, 409, 'doublon API = 409');

  const leakHandler = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('candidate'),
    getJob: async () => job() as never,
    record: async () => ({
      ok: false,
      reason: 'db_error',
      message: 'DETAIL_INTERNE_BASE_A_NE_PAS_EXPOSER',
    }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: false, reason: 'not_found' }),
  });
  const leakRes = await leakHandler.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A }),
    }),
  );
  const leakBody = await leakRes.json();
  assertEqual(leakRes.status, 500, 'erreur base = 500');
  assert(
    !JSON.stringify(leakBody).includes('DETAIL_INTERNE_BASE_A_NE_PAS_EXPOSER'),
    'message technique de la base non exposé au client',
  );

  const noMethodHandler = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('candidate'),
    getJob: async () => job({ apply_link: null, apply_email: null }) as never,
    record: async () => ({ ok: false, reason: 'db_error' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: false, reason: 'not_found' }),
  });
  const noMethodRes = await noMethodHandler.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A }),
    }),
  );
  assertEqual(noMethodRes.status, 400, 'offre sans canal de candidature = 400');

  const invalidResumeRes = await duplicateHandler.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A, resume_url: 'javascript:alert(1)' }),
    }),
  );
  assertEqual(invalidResumeRes.status, 400, 'CV javascript refusé = 400');

  const tooLongCoverRes = await duplicateHandler.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A, cover_letter: 'x'.repeat(5001) }),
    }),
  );
  assertEqual(tooLongCoverRes.status, 400, 'lettre > 5000 refusée = 400');

  const rateLimitedHandler = createApplicationsHandlers({
    ...baseDeps,
    isRateLimited: () => true,
    getSessionUser: async () => session('candidate'),
    getJob: async () => job() as never,
    record: async () => ({ ok: false, reason: 'db_error' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: false, reason: 'not_found' }),
  });
  const rateLimitedRes = await rateLimitedHandler.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A }),
    }),
  );
  assertEqual(rateLimitedRes.status, 429, 'rate limit POST = 429');

  const events: Array<{ event: string; userId?: string | null; label?: string | null }> = [];
  const successHandler = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('candidate'),
    getJob: async () => job() as never,
    record: async () => ({
      ok: true,
      data: { ...created.data, status: 'to_finalize' as const },
    }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: true, data: { ...created.data, status: 'sent' as const } }),
    recordEvent: async (event) => {
      events.push(event);
      return true;
    },
  });
  const successRes = await successHandler.POST(
    new Request('http://localhost/api/applications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_id: JOB_A, apply_method: 'external' }),
    }),
  );
  assertEqual(successRes.status, 201, 'POST candidat valide = 201');
  assert(
    events.some((event) => event.event === 'application_started' && event.userId === USER_A),
    'application_started émis après enregistrement',
  );

  const sentRes = await successHandler.PATCH(
    new Request('http://localhost/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: created.data.id, status: 'sent' }),
    }),
  );
  assertEqual(sentRes.status, 200, 'PATCH statut envoyé = 200');
  assert(
    events.some((event) => event.event === 'application_confirmed' && event.userId === USER_A),
    'application_confirmed émis au marquage envoyé',
  );

  // Statut déjà posé : la réponse reste 200 mais aucun nouvel événement.
  const noopEvents: string[] = [];
  const noopHandler = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('candidate'),
    getJob: async () => job() as never,
    record: async () => ({ ok: false, reason: 'db_error' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({
      ok: true,
      data: { ...created.data, status: 'sent' as const },
      changed: false,
    }),
    recordEvent: async (event) => {
      noopEvents.push(event.event);
      return true;
    },
  });
  const noopRes = await noopHandler.PATCH(
    new Request('http://localhost/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: created.data.id, status: 'sent' }),
    }),
  );
  assertEqual(noopRes.status, 200, 'PATCH sans changement = 200');
  assertEqual(noopEvents, [], 'aucun événement analytics sur un statut déjà posé');

  // 11. API : PATCH propriétaire uniquement.
  console.log('\n11. API PATCH');
  const patchHandler = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('candidate', USER_B),
    getJob: async () => job() as never,
    record: async () => ({ ok: false, reason: 'db_error' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => ({ ok: false, reason: 'not_found' }),
  });
  const foreignPatch = await patchHandler.PATCH(
    new Request('http://localhost/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: created.data.id, status: 'sent' }),
    }),
  );
  assertEqual(foreignPatch.status, 404, 'PATCH candidature d’autrui = 404');

  const invalidStatusPatch = await patchHandler.PATCH(
    new Request('http://localhost/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: created.data.id, status: 'hired' }),
    }),
  );
  assertEqual(invalidStatusPatch.status, 400, 'PATCH statut entreprise refusé = 400');

  // Identifiant malformé : même 404 que SQLite, sans requête base (Supabase
  // renverrait sinon une erreur de cast UUID propre à PostgREST).
  let malformedLookup = false;
  const malformedHandler = createApplicationsHandlers({
    ...baseDeps,
    getSessionUser: async () => session('candidate'),
    getJob: async () => job() as never,
    record: async () => ({ ok: false, reason: 'db_error' }),
    list: async () => ({ ok: true, data: [] }),
    updateStatus: async () => {
      malformedLookup = true;
      return { ok: false, reason: 'not_found' };
    },
  });
  const malformedPatch = await malformedHandler.PATCH(
    new Request('http://localhost/api/applications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: 'pas-un-uuid', status: 'sent' }),
    }),
  );
  assertEqual(malformedPatch.status, 404, 'PATCH identifiant malformé = 404');
  assert(!malformedLookup, 'identifiant malformé rejeté sans requête base');

  // Nettoyage.
  __resetApplicationServiceForTests();
  try {
    rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Windows peut garder un handle quelques millisecondes.
  }

  console.log('\n\n' + '-'.repeat(60));
  if (failed > 0) {
    console.error(`${failed} test(s) failed, ${passed} passed`);
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    process.exit(1);
  }
  console.log(`All ${passed} assertions passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

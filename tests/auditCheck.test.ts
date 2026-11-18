/**
 * Tests du garde-fou npm audit (scripts/audit-check.mjs).
 * Run with: npx tsx tests/auditCheck.test.ts
 *
 * Aucun accès réseau : les sorties de `npm audit` sont simulées. Aucune
 * dépendance au registre npm réel n'est nécessaire.
 */

import {
  ALLOWED_ADVISORIES,
  allowanceStatus,
  evaluateCommand,
  evaluateReport,
  isAllowed,
} from '../scripts/audit-check.mjs';

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

type Via = string | Record<string, unknown>;
type BlockingEntry = { name: string; severity: string; range?: string };

const ALLOWED_ID = ALLOWED_ADVISORIES[0].id;
const ALLOWED_EXPIRY = ALLOWED_ADVISORIES[0].expires;
const DAY_BEFORE_EXPIRY = '2026-12-17';
const TODAY = '2026-11-18';

function advisory(id: string, severity = 'high'): Record<string, unknown> {
  return {
    source: 1,
    name: 'dep',
    dependency: 'dep',
    title: `Avis ${id}`,
    url: `https://github.com/advisories/${id}`,
    severity,
  };
}

function vulnerable(severity: string, via: Via[]): Record<string, unknown> {
  return { name: 'pkg', severity, via, range: '*', nodes: ['node_modules/pkg'] };
}

function makeReport(vulnerabilities: Record<string, unknown>): Record<string, unknown> {
  return {
    auditReportVersion: 2,
    vulnerabilities,
    metadata: { vulnerabilities: { high: 0, critical: 0, total: 0 } },
  };
}

function blockingNames(blocking: BlockingEntry[]): string[] {
  return blocking.map((entry) => entry.name).sort();
}

console.log('\nRunning audit-check tests...\n');

// ---- 1. Autorisation et expiration de l'exception ----
console.log('\n1. Autorisation et expiration');
assertEqual(
  isAllowed(ALLOWED_ID, { today: TODAY }),
  true,
  'avis autorisé avant expiration',
);
assertEqual(
  isAllowed(ALLOWED_ID, { today: DAY_BEFORE_EXPIRY }),
  true,
  'avis autorisé la veille de l’expiration',
);
assertEqual(
  isAllowed(ALLOWED_ID, { today: ALLOWED_EXPIRY }),
  false,
  'avis inactif dès le début de la date d’expiration',
);
assertEqual(
  isAllowed(ALLOWED_ID, { today: '2026-12-19' }),
  false,
  'avis inactif après expiration',
);
assertEqual(
  isAllowed('GHSA-inconnu', { today: TODAY }),
  false,
  'avis non déclaré refusé',
);
assertEqual(
  allowanceStatus(ALLOWED_ID, { today: DAY_BEFORE_EXPIRY }),
  'allowed',
  'statut allowed avant expiration',
);
assertEqual(
  allowanceStatus(ALLOWED_ID, { today: ALLOWED_EXPIRY }),
  'expired',
  'statut expired le jour même',
);
assertEqual(
  allowanceStatus('GHSA-inconnu', { today: TODAY }),
  'unknown',
  'statut unknown pour un avis non déclaré',
);

// ---- 2. Avis autorisé (chaîne complète) ----
console.log('\n2. Avis autorisé');
{
  const outcome = evaluateReport(
    makeReport({
      picomatch: vulnerable('high', [advisory(ALLOWED_ID)]),
      micromatch: vulnerable('high', ['picomatch']),
      'eslint-config-next': vulnerable('high', ['micromatch']),
    }),
    { today: TODAY },
  );
  assertEqual(outcome.ok, true, 'avis autorisé non bloquant');
  assertEqual(outcome.ignored, 3, 'chaîne autorisée entièrement couverte');
  assertEqual(outcome.blocking, [], 'aucune vulnérabilité bloquante');
}

// ---- 3. Nouvelle vulnérabilité High non autorisée ----
console.log('\n3. High inconnue');
{
  const outcome = evaluateReport(
    makeReport({ 'evil-pkg': vulnerable('high', [advisory('GHSA-new-high')]) }),
    { today: TODAY },
  );
  assertEqual(outcome.ok, false, 'high inconnue bloquante');
  assertEqual(outcome.reason, 'blocking', 'raison blocking');
  assertEqual(blockingNames(outcome.blocking), ['evil-pkg'], 'paquet bloquant listé');
  assertEqual(outcome.ignored, 0, 'aucune exception appliquée');
}

// ---- 4. Vulnérabilité Critical non autorisée ----
console.log('\n4. Critical inconnue');
{
  const outcome = evaluateReport(
    makeReport({ 'evil-crit': vulnerable('critical', [advisory('GHSA-new-critical', 'critical')]) }),
    { today: TODAY },
  );
  assertEqual(outcome.ok, false, 'critical inconnue bloquante');
  assertEqual(blockingNames(outcome.blocking), ['evil-crit'], 'paquet critical listé');
  assertEqual(outcome.blocking[0].severity, 'critical', 'sévérité critical conservée');
}

// ---- 5. Exception expirée ----
console.log('\n5. Exception expirée');
{
  const stillValid = evaluateReport(
    makeReport({ picomatch: vulnerable('high', [advisory(ALLOWED_ID)]) }),
    { today: DAY_BEFORE_EXPIRY },
  );
  assertEqual(stillValid.ok, true, 'exception valide la veille');

  const expired = evaluateReport(
    makeReport({ picomatch: vulnerable('high', [advisory(ALLOWED_ID)]) }),
    { today: ALLOWED_EXPIRY },
  );
  assertEqual(expired.ok, false, 'exception expirée bloquante le jour J');
  assertEqual(blockingNames(expired.blocking), ['picomatch'], 'paquet bloquant après expiration');
  assertEqual(expired.expiredAdvisories.has(ALLOWED_ID), true, 'avis expiré signalé');
}

// ---- 6. Erreurs d'exécution et de parsing ----
console.log('\n6. Erreurs npm audit');
{
  const spawnError = evaluateCommand({ error: new Error('spawn failed') }, { today: TODAY });
  assertEqual(spawnError.ok, false, 'erreur de spawn bloquante');
  assertEqual(spawnError.reason, 'spawn-error', 'raison spawn-error');

  const invalid = evaluateCommand({ stdout: '<html>not json</html>' }, { today: TODAY });
  assertEqual(invalid.ok, false, 'JSON invalide bloquant');
  assertEqual(invalid.reason, 'invalid-json', 'raison invalid-json');

  const empty = evaluateCommand({ stdout: '   ' }, { today: TODAY });
  assertEqual(empty.ok, false, 'sortie vide bloquante');
  assertEqual(empty.reason, 'invalid-json', 'sortie vide = invalid-json');

  const auditError = evaluateReport({ error: { code: 'EAI_AGAIN' } }, { today: TODAY });
  assertEqual(auditError.ok, false, 'erreur npm audit bloquante');
  assertEqual(auditError.reason, 'audit-error', 'raison audit-error');

  const invalidReport = evaluateReport(null, { today: TODAY });
  assertEqual(invalidReport.ok, false, 'rapport invalide bloquant');
  assertEqual(invalidReport.reason, 'invalid-report', 'raison invalid-report');

  const valid = evaluateCommand({ stdout: JSON.stringify(makeReport({})) }, { today: TODAY });
  assertEqual(valid.ok, true, 'rapport vide valide');
  assertEqual(valid.reason, 'ok', 'raison ok');
}

// ---- 7. Plusieurs avis, un seul autorisé ----
console.log('\n7. Plusieurs avis');
{
  const outcome = evaluateReport(
    makeReport({
      allowed: vulnerable('high', [advisory(ALLOWED_ID)]),
      other: vulnerable('high', [advisory('GHSA-other-high')]),
      root: vulnerable('high', ['allowed', 'other']),
    }),
    { today: TODAY },
  );
  assertEqual(outcome.ok, false, 'un avis non autorisé fait échouer le contrôle');
  assertEqual(outcome.ignored, 1, 'seul l’avis autorisé est ignoré');
  assertEqual(blockingNames(outcome.blocking), ['other', 'root'], 'other et root bloquants');
}

// ---- 8. Vulnérabilité propagée par plusieurs chemins ----
console.log('\n8. Chemins multiples');
{
  const allAllowed = evaluateReport(
    makeReport({
      left: vulnerable('high', [advisory(ALLOWED_ID)]),
      right: vulnerable('high', [advisory(ALLOWED_ID)]),
      root: vulnerable('high', ['left', 'right']),
    }),
    { today: TODAY },
  );
  assertEqual(allAllowed.ok, true, 'tous les chemins autorisés');
  assertEqual(allAllowed.ignored, 3, 'tous les paquets de la chaîne couverts');

  const mixed = evaluateReport(
    makeReport({
      left: vulnerable('high', [advisory(ALLOWED_ID)]),
      right: vulnerable('high', [advisory('GHSA-other-high')]),
      root: vulnerable('high', ['left', 'right']),
    }),
    { today: TODAY },
  );
  assertEqual(mixed.ok, false, 'un chemin non autorisé bloque la racine');
  assertEqual(mixed.ignored, 1, 'seul le chemin autorisé est ignoré');
  assertEqual(blockingNames(mixed.blocking), ['right', 'root'], 'right et root bloquants');
}

// ---- 9. Sévérités non bloquantes ----
console.log('\n9. Sévérités non bloquantes');
{
  const outcome = evaluateReport(
    makeReport({ moderate: vulnerable('moderate', [advisory('GHSA-moderate', 'moderate')]) }),
    { today: TODAY },
  );
  assertEqual(outcome.ok, true, 'moderate non bloquant');
  assertEqual(outcome.blocking, [], 'aucun bloquant moderate');
}

// ---- 10. Cycles de dépendances ----
console.log('\n10. Cycles');
{
  const outcome = evaluateReport(
    makeReport({
      a: vulnerable('high', ['b']),
      b: vulnerable('high', ['a']),
    }),
    { today: TODAY },
  );
  assertEqual(outcome.ok, false, 'cycle bloquant sans boucle infinie');
  assertEqual(blockingNames(outcome.blocking), ['a', 'b'], 'les deux paquets du cycle bloquants');
}

// ---- Résultats ----
console.log('\n\nResults:');
console.log(`   Passed: ${passed}`);
console.log(`   Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log('\nFailures:');
  failures.forEach((f) => console.log(`   - ${f}`));
  process.exit(1);
} else {
  console.log('\nAll tests passed!\n');
  process.exit(0);
}

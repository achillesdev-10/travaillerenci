/**
 * Unit tests for the traffic source helper (master prompt §23).
 * Run with: npx tsx tests/trafficSource.test.ts
 */

import {
  DIRECT_SOURCE,
  INTERNAL_SOURCE,
  MAX_SOURCE_LENGTH,
  normalizeSource,
  resolveTrafficSource,
  sourceFromPath,
} from '../src/lib/trafficSource';

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

console.log('\nRunning trafficSource tests...\n');

// ---- 1. normalizeSource ----
console.log('\n1. normalizeSource');
assertEqual(normalizeSource('Facebook'), 'facebook', 'minuscules');
assertEqual(normalizeSource('  Google Search  '), 'google-search', 'espaces → tiret');
assertEqual(normalizeSource('NEWSLETTER & CO'), 'newsletter-co', 'caractères exotiques retirés');
assertEqual(normalizeSource(''), DIRECT_SOURCE, 'vide → direct');
assertEqual(normalizeSource(null), DIRECT_SOURCE, 'null → direct');
assertEqual(normalizeSource(undefined), DIRECT_SOURCE, 'undefined → direct');
assert(
  normalizeSource('x'.repeat(120)).length <= MAX_SOURCE_LENGTH,
  `longueur bornée à ${MAX_SOURCE_LENGTH}`,
);

// ---- 2. sourceFromPath ----
console.log('\n2. sourceFromPath');
assertEqual(sourceFromPath('/jobs?utm_source=facebook'), 'facebook', 'utm_source lu');
assertEqual(sourceFromPath('/jobs?utm_source=LinkedIn&utm_medium=social'), 'linkedin', 'autres params ignorés');
assertEqual(sourceFromPath('/jobs'), '', 'pas de query → vide');
assertEqual(sourceFromPath('/jobs?utm_medium=email'), '', 'pas d’utm_source → vide');
assertEqual(sourceFromPath(null), '', 'null → vide');
assertEqual(sourceFromPath('invalide?utm_source=whatsapp'), 'whatsapp', 'chemin sans slash accepté');

// ---- 3. resolveTrafficSource ----
console.log('\n3. resolveTrafficSource');
assertEqual(
  resolveTrafficSource({ utmSource: 'youtube', referrer: 'https://facebook.com/x' }),
  'youtube',
  'UTM prioritaire sur le referer',
);
assertEqual(
  resolveTrafficSource({ referrer: 'https://www.jeuneafrique.com/jobs', currentHost: 'travaillerenci.ci' }),
  'jeuneafrique.com',
  'domaine du referer sans www',
);
assertEqual(
  resolveTrafficSource({ referrer: 'https://travaillerenci.ci/jobs', currentHost: 'www.travaillerenci.ci' }),
  INTERNAL_SOURCE,
  'navigation interne',
);
assertEqual(resolveTrafficSource({}), DIRECT_SOURCE, 'aucun signal → direct');
assertEqual(
  resolveTrafficSource({ referrer: 'pas-une-url', currentHost: 'travaillerenci.ci' }),
  DIRECT_SOURCE,
  'referer illisible → direct',
);

// ---- 4. Résultats ----
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

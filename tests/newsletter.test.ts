/**
 * Unit tests for the newsletter architecture helpers (master prompt §20).
 * Run with: npx tsx tests/newsletter.test.ts
 */

import {
  DEFAULT_NEWSLETTER_FREQUENCY,
  DEFAULT_NEWSLETTER_SOURCE,
  DEFAULT_NEWSLETTER_STATUS,
  MAX_EMAIL_LENGTH,
  NEWSLETTER_FREQUENCIES,
  NEWSLETTER_SOURCES,
  NEWSLETTER_STATUSES,
  extractUtmParams,
  isSendableNewsletterStatus,
  isValidNewsletterEmail,
  normalizeNewsletterEmail,
  normalizeNewsletterFrequency,
  normalizeNewsletterSource,
  normalizeNewsletterStatus,
} from '../src/lib/newsletter';

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
    `${testName} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
  );
}

// ── Normalisation / validation des emails ────────────────────────────────────
assertEqual(normalizeNewsletterEmail('  Moi@Example.COM '), 'moi@example.com', 'email trim + casse');
assertEqual(normalizeNewsletterEmail('   '), '', 'email vide');
assertEqual(normalizeNewsletterEmail(42), '', 'email non-string');
assertEqual(normalizeNewsletterEmail(null), '', 'email null');
assert(
  normalizeNewsletterEmail(`${'a'.repeat(400)}@x.io`).length <= MAX_EMAIL_LENGTH,
  'email tronqué à MAX_EMAIL_LENGTH',
);

assertEqual(isValidNewsletterEmail('moi@example.com'), true, 'email valide');
assertEqual(isValidNewsletterEmail('moi+x@exemple.ci'), true, 'email avec tag valide');
assertEqual(isValidNewsletterEmail('Moi@Example.com'), true, 'email valide avant normalisation');
assertEqual(isValidNewsletterEmail('pas-de-at.example.com'), false, 'email sans @');
assertEqual(isValidNewsletterEmail('moi@localhost'), false, 'domaine sans point');
assertEqual(isValidNewsletterEmail('moi @example.com'), false, 'espace refusé');
assertEqual(isValidNewsletterEmail(''), false, 'vide refusé');
assertEqual(isValidNewsletterEmail(null), false, 'null refusé');

// ── Valeurs par défaut (jamais « active » par accident) ──────────────────────
assertEqual(DEFAULT_NEWSLETTER_SOURCE, 'footer', 'source par défaut');
assertEqual(DEFAULT_NEWSLETTER_STATUS, 'pending', 'statut par défaut = pending');
assertEqual(DEFAULT_NEWSLETTER_FREQUENCY, 'hebdomadaire', 'fréquence par défaut');
assertEqual(normalizeNewsletterStatus('unknown'), 'pending', 'statut inconnu → pending');
assertEqual(normalizeNewsletterSource('unknown'), 'footer', 'source inconnue → footer');
assertEqual(normalizeNewsletterFrequency('unknown'), 'hebdomadaire', 'fréquence inconnue → défaut');
assertEqual(normalizeNewsletterStatus('active'), 'active', 'statut actif conservé');
assertEqual(normalizeNewsletterSource('footer'), 'footer', 'source footer conservée');

// ── Envoi : uniquement les statuts « active » ────────────────────────────────
assertEqual(isSendableNewsletterStatus('active'), true, 'active → envoi');
assertEqual(isSendableNewsletterStatus('pending'), false, 'pending → pas d’envoi');
assertEqual(isSendableNewsletterStatus('unsubscribed'), false, 'unsubscribed → pas d’envoi');
assertEqual(isSendableNewsletterStatus('bounced'), false, 'bounced → pas d’envoi');
assertEqual(isSendableNewsletterStatus(null), false, 'statut inconnu → pas d’envoi');

// ── Catalogues ───────────────────────────────────────────────────────────────
assertEqual(new Set(NEWSLETTER_STATUSES).size, NEWSLETTER_STATUSES.length, 'statuts sans doublon');
assertEqual(new Set(NEWSLETTER_SOURCES).size, NEWSLETTER_SOURCES.length, 'sources sans doublon');
assertEqual(
  (NEWSLETTER_STATUSES as readonly string[]).includes(DEFAULT_NEWSLETTER_STATUS),
  true,
  'statut défaut présent',
);
assertEqual(
  (NEWSLETTER_SOURCES as readonly string[]).includes(DEFAULT_NEWSLETTER_SOURCE),
  true,
  'source défaut présente',
);
assertEqual(
  (NEWSLETTER_FREQUENCIES as readonly string[]).includes(DEFAULT_NEWSLETTER_FREQUENCY),
  true,
  'fréquence défaut présente',
);

// ── Extraction des UTM (§21) ────────────────────────────────────────────────
const utm = extractUtmParams('https://travaillerenci.vercel.app/?utm_source=share&utm_medium=link&utm_campaign=offre');
assertEqual(
  utm,
  { utm_source: 'share', utm_medium: 'link', utm_campaign: 'offre' },
  'UTM extraits depuis une URL',
);
assertEqual(extractUtmParams('https://travaillerenci.vercel.app/jobs'), null, 'sans UTM → null');
assertEqual(extractUtmParams('not a url'), null, 'entrée invalide → null');
assertEqual(extractUtmParams(null), null, 'null → null');
assertEqual(
  extractUtmParams({ utm_source: 'footer' }),
  { utm_source: 'footer', utm_medium: null, utm_campaign: null },
  'UTM extraits depuis un objet',
);

// ── Bilan ────────────────────────────────────────────────────────────────────
process.stdout.write('\n');
if (failed > 0) {
  console.error(`${failed} test(s) failed, ${passed} passed.`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`All ${passed} tests passed.`);

/**
 * Unit tests for getJobThumbnail keyword matching logic.
 * Run with: npx tsx tests/jobThumbnails.test.ts
 */

import { getJobThumbnail } from '../src/lib/jobThumbnails';
import type { JobOfferSchema } from '../src/types';

// ---------------------------------------------------------------------------
//  Test helpers
// ---------------------------------------------------------------------------
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

function assertEqual(actual: string, expected: string, testName: string) {
  const pass = actual === expected;
  assert(pass, `${testName}: expected "${expected}", got "${actual}"`);
}

function createJob(overrides: Partial<JobOfferSchema> = {}): JobOfferSchema {
  return {
    id: 'test-id-123',
    title: 'Test Job',
    company: 'Test Company',
    location: 'Abidjan',
    contract_type: 'CDI',
    description: 'Test description for the job offer',
    apply_link: null,
    apply_email: null,
    deadline: null,
    source_url: null,
    source_website: null,
    status: 'published',
    seo_title: null,
    seo_description: null,
    seo_keywords: null,
    slug: null,
    is_verified: false,
    is_archived: false,
    is_expired: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
//  Test suite
// ---------------------------------------------------------------------------
console.log('\n🧪 Running getJobThumbnail tests...\n');

// ---- 1. Explicit image (future-proof) ----
console.log('\n1. Explicit image priority');

const jobWithImage = createJob({ title: 'Dev React' });
(jobWithImage as any).image_url = 'https://example.com/custom-image.jpg';
assertEqual(
  getJobThumbnail(jobWithImage),
  'https://example.com/custom-image.jpg',
  'Returns explicit image_url'
);

const jobWithImage2 = createJob({ title: 'Dev React' });
(jobWithImage2 as any).image = 'https://example.com/another-image.jpg';
assertEqual(
  getJobThumbnail(jobWithImage2),
  'https://example.com/another-image.jpg',
  'Returns explicit image field'
);

// ---- 2. Company logo (future-proof) ----
console.log('\n2. Company logo priority');

const jobWithLogo = createJob({ title: 'Dev React' });
(jobWithLogo as any).company_logo = 'https://example.com/logo.png';
assertEqual(
  getJobThumbnail(jobWithLogo),
  'https://example.com/logo.png',
  'Returns company logo'
);

// ---- 3. Keyword matching ----
console.log('\n3. Keyword matching');

// IT / Digital
assertEqual(
  getJobThumbnail(createJob({ title: 'Développeur React' })),
  '/images/categories/informatique.svg',
  'Matches "Développeur" → informatique'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Frontend Developer' })),
  '/images/categories/informatique.svg',
  'Matches "Developer" → informatique'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Ingenieur Logiciel' })),
  '/images/categories/informatique.svg',
  'Matches "Ingenieur Logiciel" → informatique'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'DevOps Engineer' })),
  '/images/categories/informatique.svg',
  'Matches "DevOps" → informatique'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Data Analyst' })),
  '/images/categories/informatique.svg',
  'Matches "Data" → informatique'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Cybersecurite Specialist' })),
  '/images/categories/informatique.svg',
  'Matches "Cybersecurite" → informatique'
);

// Finance / Banking
assertEqual(
  getJobThumbnail(createJob({ title: 'Comptable Senior' })),
  '/images/categories/finance.svg',
  'Matches "Comptable" → finance'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Auditeur Interne' })),
  '/images/categories/finance.svg',
  'Matches "Auditeur" → finance'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Banquier Commercial' })),
  '/images/categories/finance.svg',
  'Matches "Banquier" → finance'
);

// Health
assertEqual(
  getJobThumbnail(createJob({ title: 'Infirmier Generaliste' })),
  '/images/categories/sante.svg',
  'Matches "Infirmier" → sante'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Medecin Traitant' })),
  '/images/categories/sante.svg',
  'Matches "Medecin" → sante'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Pharmacien Hospitalier' })),
  '/images/categories/sante.svg',
  'Matches "Pharmacien" → sante'
);

// Education
assertEqual(
  getJobThumbnail(createJob({ title: 'Enseignant Mathematiques' })),
  '/images/categories/education.svg',
  'Matches "Enseignant" → education'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Professeur Francais' })),
  '/images/categories/education.svg',
  'Matches "Professeur" → education'
);

// Commerce
assertEqual(
  getJobThumbnail(createJob({ title: 'Commercial Terrain' })),
  '/images/categories/commerce.svg',
  'Matches "Commercial" → commerce'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Vendeur Automobile' })),
  '/images/categories/commerce.svg',
  'Matches "Vendeur" → commerce'
);

// Transport
assertEqual(
  getJobThumbnail(createJob({ title: 'Chauffeur Livreur' })),
  '/images/categories/transport.svg',
  'Matches "Chauffeur" → transport'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Conducteur Bus' })),
  '/images/categories/transport.svg',
  'Matches "Conducteur" → transport'
);

// BTP
assertEqual(
  getJobThumbnail(createJob({ title: 'Electricien BTP' })),
  '/images/categories/btp.svg',
  'Matches "Electricien" → btp'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Chef de Chantier' })),
  '/images/categories/btp.svg',
  'Matches "Chantier" → btp'
);

// Restaurant / Hotel
assertEqual(
  getJobThumbnail(createJob({ title: 'Serveur Restaurant' })),
  '/images/categories/restauration.svg',
  'Matches "Serveur" → restauration'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Cuisinier Principal' })),
  '/images/categories/restauration.svg',
  'Matches "Cuisinier" → restauration'
);

// Security
assertEqual(
  getJobThumbnail(createJob({ title: 'Agent Securite' })),
  '/images/categories/securite.svg',
  'Matches "Securite" → securite'
);

// Telecoms
assertEqual(
  getJobThumbnail(createJob({ title: 'Technicien Telecom' })),
  '/images/categories/telecoms.svg',
  'Matches "Telecom" → telecoms'
);

// ---- 4. Case insensitivity ----
console.log('\n4. Case insensitivity');

assertEqual(
  getJobThumbnail(createJob({ title: 'DEVELOPEUR REACT' })),
  '/images/categories/informatique.svg',
  'Uppercase "DEVELOPEUR" → informatique'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'infirmier en chef' })),
  '/images/categories/sante.svg',
  'Lowercase "infirmier" → sante'
);

// ---- 5. Accent tolerance ----
console.log('\n5. Accent tolerance');

assertEqual(
  getJobThumbnail(createJob({ title: 'Développeur Web' })),
  '/images/categories/informatique.svg',
  'Accent "Développeur" → informatique'
);

assertEqual(
  getJobThumbnail(createJob({ title: 'Comptable Général' })),
  '/images/categories/finance.svg',
  'Accent "Général" → finance'
);

// ---- 6. Category-based fallback ----
console.log('\n6. Category-based fallback');

assertEqual(
  getJobThumbnail(createJob({ category: 'internship' })),
  '/images/categories/education.svg',
  'Internship category → education'
);

assertEqual(
  getJobThumbnail(createJob({ category: 'scholarship' })),
  '/images/categories/education.svg',
  'Scholarship category → education'
);

assertEqual(
  getJobThumbnail(createJob({ category: 'exam' })),
  '/images/categories/generic.svg',
  'Exam category → generic'
);

// ---- 7. Contract-type heuristic ----
console.log('\n7. Contract-type heuristic');

assertEqual(
  getJobThumbnail(createJob({ contract_type: 'Stage' })),
  '/images/categories/education.svg',
  'Stage contract → education'
);

// ---- 8. Generic fallback ----
console.log('\n8. Generic fallback');

assertEqual(
  getJobThumbnail(createJob({ title: 'Unknown Position' })),
  '/images/categories/generic.svg',
  'Unknown title → generic fallback'
);

assertEqual(
  getJobThumbnail(createJob({ title: '' })),
  '/images/categories/generic.svg',
  'Empty title → generic fallback'
);

// ---- 9. Unknown data does not crash ----
console.log('\n9. Unknown data does not crash');

try {
  const result = getJobThumbnail(createJob({ title: 'Test', description: '' }));
  assert(typeof result === 'string', 'Does not crash with empty description');
} catch (e) {
  assert(false, `Crashed with empty description: ${e}`);
}

try {
  const result = getJobThumbnail(createJob({ title: '', company: '', description: '' }));
  assert(typeof result === 'string', 'Does not crash with all empty fields');
} catch (e) {
  assert(false, `Crashed with all empty fields: ${e}`);
}

// ---- 10. Word boundary matching ----
console.log('\n10. Word boundary matching');

// "com" should not match "comptable" (word boundary)
assertEqual(
  getJobThumbnail(createJob({ title: 'Com' })),
  '/images/categories/generic.svg',
  '"Com" alone does not match "Comptable"'
);

// "ban" should not match "banque" (word boundary)
assertEqual(
  getJobThumbnail(createJob({ title: 'Ban' })),
  '/images/categories/generic.svg',
  '"Ban" alone does not match "Banque"'
);

// ---------------------------------------------------------------------------
//  Results
// ---------------------------------------------------------------------------
console.log('\n\n📊 Results:');
console.log(`   ✅ Passed: ${passed}`);
console.log(`   ❌ Failed: ${failed}`);
console.log(`   Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log('\n❌ Failures:');
  failures.forEach((f) => console.log(`   - ${f}`));
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!\n');
  process.exit(0);
}

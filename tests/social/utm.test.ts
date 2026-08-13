import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareUrl, contentPath } from '../../src/services/social/utm';

test('contentPath : chemins exacts par catégorie', () => {
  assert.equal(contentPath('job', { id: 'j1' }), '/jobs/j1');
  assert.equal(contentPath('internship', { id: 'j2' }), '/jobs/j2');
  assert.equal(contentPath('scholarship', { id: 'b1' }), '/bourses/b1');
  assert.equal(contentPath('exam', { id: 'e1', slug: 'concours-ena' }), '/concours/concours-ena');
  assert.equal(contentPath('exam', { id: 'e1' }), '/concours/e1');
});

test('buildShareUrl : UTM source/medium/campaign correctement encodés', () => {
  const url = buildShareUrl(
    'https://travaillerenci.vercel.app',
    'job',
    { id: 'abc-123' },
    'facebook',
  );
  assert.equal(
    url,
    'https://travaillerenci.vercel.app/jobs/abc-123?utm_source=facebook&utm_medium=social&utm_campaign=job',
  );

  const li = buildShareUrl(
    'https://travaillerenci.vercel.app',
    'exam',
    { id: 'e1' },
    'linkedin',
  );
  assert.equal(
    li,
    'https://travaillerenci.vercel.app/concours/e1?utm_source=linkedin&utm_medium=social&utm_campaign=exam',
  );
});

test('buildShareUrl : l\'URL existante n\'est jamais cassée (encodage)', () => {
  const url = buildShareUrl('https://site.example', 'scholarship', { id: 'id avec espaces & symboles' }, 'facebook');
  assert.ok(url.startsWith('https://site.example/bourses/id%20avec%20espaces%20%26%20symboles?'));
  assert.ok(url.includes('utm_campaign=scholarship'));
});

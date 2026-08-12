/**
 *  TravaillerEnCi — Tests de l'Assistant TravaillerenCi (V1)
 *  Chemin : scripts/test-assistant.ts
 *
 *  Couvre :
 *   • Détection d'intention (catégorie, ville, domaine, FAQ, IA) — §7 mission
 *   • Réponses prédéfinies FAQ + navigation — §13 mission
 *   • Recherche en base (emplois, stages, bourses, concours) — §5/§22 mission
 *   • Logique de fallback IA Gemini → Groq (fetch mocké, sans réseau) — §9 mission
 *   • Limites (rate limiting, longueur de message) — §10/§11 mission
 *
 *  USAGE :
 *    npm run test:assistant
 *
 *  NB : la recherche en base utilise la BDD locale (SQLite) ; si Supabase est
 *  configuré dans l'environnement, les tests interrogent Supabase (lecture).
 */

import assert from 'node:assert/strict';

// -----------------------------------------------------------------------------
// Services testés
// -----------------------------------------------------------------------------
import {
  detectIntent,
  detectCategories,
  detectLocation,
  extractKeywords,
} from '../src/services/assistant/intentDetector';
import { getFaqReply, listFaqKeys } from '../src/services/assistant/faqService';
import {
  searchOpportunities,
  seeMoreUrlFor,
} from '../src/services/assistant/searchService';
import { generateAiReply } from '../src/services/assistant/aiService';
import {
  checkAiLimits,
  checkMessageLimits,
  getMaxMessageLength,
} from '../src/services/assistant/rateLimiter';

// -----------------------------------------------------------------------------
// Exécuteur de tests (attends les fonctions async)
// -----------------------------------------------------------------------------
let failures = 0;
let totalChecks = 0;

async function runCheck(name: string, fn: () => void | Promise<void>): Promise<void> {
  totalChecks++;
  try {
    await fn();
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failures++;
    console.error(`  ❌ ${name} — ${(err as Error).message}`);
  }
}

async function runChecks(
  title: string,
  fns: Array<[string, () => void | Promise<void>]>,
): Promise<void> {
  console.log(`\n▶ ${title}`);
  for (const [name, fn] of fns) {
    await runCheck(name, fn);
  }
}

// -----------------------------------------------------------------------------
// Section A — Détection d'intention (§7)
// -----------------------------------------------------------------------------

async function sectionIntentDetection() {
  await runChecks('Détection d\'intention (catégories, villes, domaines)', [
    ['« je cherche un emploi » → catégorie job', () => {
      const i = detectIntent('je cherche un emploi');
      assert.equal(i.kind, 'search');
      assert.deepEqual(i.search?.categories, ['job']);
    }],
    ['« je cherche un stage » → catégorie internship', () => {
      const i = detectIntent('je cherche un stage');
      assert.equal(i.kind, 'search');
      assert.ok(i.search?.categories.includes('internship'));
    }],
    ['« concours disponibles » → catégorie exam', () => {
      const i = detectIntent('quels concours sont disponibles ?');
      assert.equal(i.kind, 'search');
      assert.ok(i.search?.categories.includes('exam'));
    }],
    ['« bourses disponibles » → catégorie scholarship', () => {
      const i = detectIntent('quelles bourses sont disponibles ?');
      assert.equal(i.kind, 'search');
      assert.ok(i.search?.categories.includes('scholarship'));
    }],
    ['« emploi à Bouaké » → job + ville Bouaké', () => {
      const i = detectIntent('je cherche un emploi à Bouaké');
      assert.equal(i.kind, 'search');
      assert.ok(i.search?.categories.includes('job'));
      assert.equal(i.search?.location, 'Bouaké');
    }],
    ['« stage informatique à Abidjan » → internship + ville + domaine', () => {
      const i = detectIntent('stage informatique à Abidjan');
      assert.equal(i.kind, 'search');
      assert.ok(i.search?.categories.includes('internship'));
      assert.equal(i.search?.location, 'Abidjan');
      assert.ok(i.search?.keywords.some((k) => k.toLowerCase().includes('informatique')));
    }],
    ['« montrer les offres à Abidjan » → ville détectée', () => {
      const i = detectIntent('montre-moi les offres à Abidjan');
      assert.equal(i.kind, 'search');
      assert.equal(i.search?.location, 'Abidjan');
    }],
    ['« je viens d\'avoir le BAC, que faire ? » → IA (demande complexe)', () => {
      const i = detectIntent('je viens d\'avoir le BAC et je voudrais savoir quelles opportunités pourraient me convenir');
      assert.equal(i.kind, 'ai');
    }],
    ['message vague (« bonjour ça va ? ») → IA (fallback)', () => {
      const i = detectIntent('bonjour ça va ?');
      assert.equal(i.kind, 'ai');
    }],
    ['FAQ « comment créer un compte ? »', () => {
      const i = detectIntent('comment créer un compte ?');
      assert.equal(i.kind, 'faq');
      assert.equal(i.faqKey, 'create_account');
    }],
    ['FAQ « où créer mon cv ? »', () => {
      const i = detectIntent('où créer mon CV ?');
      assert.equal(i.kind, 'faq');
      assert.equal(i.faqKey, 'create_cv');
    }],
    ['FAQ « comment vous contacter ? »', () => {
      const i = detectIntent('comment vous contacter ?');
      assert.equal(i.kind, 'faq');
      assert.equal(i.faqKey, 'contact');
    }],
    ['détection directe des villes via detectLocation', () => {
      assert.equal(detectLocation('yamoussoukro'), 'Yamoussoukro');
      assert.equal(detectLocation('cocody'), 'Cocody');
      assert.equal(detectLocation('aucune ville ici'), undefined);
    }],
    ['detectCategories retourne plusieurs catégories si demandées', () => {
      const cats = detectCategories('concours et bourses');
      assert.ok(cats.includes('exam'));
      assert.ok(cats.includes('scholarship'));
    }],
    ['extractKeywords garde les termes utiles sans les stopwords', () => {
      const kw = extractKeywords('je cherche un emploi en finance');
      assert.ok(kw.length >= 1);
      assert.ok(!kw.includes('je'));
    }],
  ]);
}

// -----------------------------------------------------------------------------
// Section B — FAQ (§13)
// -----------------------------------------------------------------------------

async function sectionFaq() {
  await runChecks('Réponses prédéfinies (FAQ)', [
    ['toutes les clés FAQ connues retournent une réponse', () => {
      const keys = listFaqKeys();
      assert.ok(keys.length >= 5, 'au moins 5 clés FAQ');
      for (const k of keys) {
        const reply = getFaqReply(k);
        assert.ok(reply, `clé ${k} → réponse`);
        assert.ok(reply.text.length > 0);
        assert.equal(reply.aiUsed, false);
      }
    }],
    ['FAQ create_cv renvoie vers /generateur-de-cv', () => {
      const reply = getFaqReply('create_cv');
      assert.equal(reply?.seeMoreUrl, '/generateur-de-cv');
    }],
    ['FAQ create_account renvoie vers /register', () => {
      const reply = getFaqReply('create_account');
      assert.equal(reply?.seeMoreUrl, '/register');
    }],
    ['clé FAQ inconnue → null', () => {
      assert.equal(getFaqReply('nimporte-quoi'), null);
    }],
  ]);
}

// -----------------------------------------------------------------------------
// Section C — Recherche en base (§5 / §22)
// -----------------------------------------------------------------------------

async function sectionSearch() {
  await runChecks('Recherche en base (données réelles)', [
    ['recherche « emploi » retourne des résultats structurés', async () => {
      const { results, total } = await searchOpportunities({ categories: ['job'], keywords: [] });
      assert.equal(typeof total, 'number');
      for (const r of results) {
        assert.ok(r.title.length > 0, 'titre non vide');
        assert.ok(r.url.startsWith('/'), 'URL interne');
        assert.ok(r.url.startsWith('/jobs/'), 'URL emploi → /jobs/');
        assert.equal(r.category, 'job');
      }
    }],
    ['recherche « stage » retourne des URLs /jobs/', async () => {
      const { results } = await searchOpportunities({ categories: ['internship'], keywords: ['stage'] });
      for (const r of results) {
        assert.ok(r.url.startsWith('/jobs/'), `URL stage : ${r.url}`);
        assert.equal(r.category, 'internship');
      }
    }],
    ['recherche « concours » retourne des URLs /concours/', async () => {
      const { results } = await searchOpportunities({ categories: ['exam'], keywords: [] });
      for (const r of results) {
        assert.ok(r.url.startsWith('/concours/'), `URL concours : ${r.url}`);
        assert.equal(r.category, 'exam');
      }
    }],
    ['recherche « bourse » retourne des URLs /bourses/', async () => {
      const { results } = await searchOpportunities({ categories: ['scholarship'], keywords: [] });
      for (const r of results) {
        assert.ok(r.url.startsWith('/bourses/'), `URL bourse : ${r.url}`);
        assert.equal(r.category, 'scholarship');
      }
    }],
    ['recherche sans catégorie interroge tout (sans planter)', async () => {
      const { results, total } = await searchOpportunities({
        categories: [],
        keywords: ['Abidjan'],
        location: 'Abidjan',
      });
      assert.equal(typeof total, 'number');
      assert.ok(Array.isArray(results));
    }],
    ['max 5 résultats retournés', async () => {
      const { results } = await searchOpportunities({ categories: [], keywords: ['a'] });
      assert.ok(results.length <= 5, `got ${results.length}`);
    }],
    ['seeMoreUrl construit des URLs valides', () => {
      assert.equal(
        seeMoreUrlFor({ categories: ['job'], keywords: ['informatique'], location: 'Abidjan' }, 'job'),
        '/jobs?q=informatique&city=Abidjan',
      );
      assert.equal(seeMoreUrlFor({ categories: ['internship'], keywords: [] }, 'internship'), '/jobs?contract=Stage');
      assert.equal(seeMoreUrlFor({ categories: ['exam'], keywords: [] }, 'exam'), '/concours');
      assert.equal(seeMoreUrlFor({ categories: ['scholarship'], keywords: [] }, 'scholarship'), '/bourses');
    }],
  ]);
}

// -----------------------------------------------------------------------------
// Section D — IA : fallback Gemini → Groq (§9) — fetch mocké, aucun appel réseau
// -----------------------------------------------------------------------------

async function sectionAiFallback() {
  const originalFetch = globalThis.fetch;
  const prevGemini = process.env.GEMINI_API_KEY;
  const prevGroq = process.env.GROQ_API_KEY;

  /** Mocke fetch : réponses successives (Gemini d'abord, puis Groq). */
  function mockFetchSequence(...responses: Array<{ ok: boolean; status: number; json: () => Promise<unknown> }>) {
    let call = 0;
    globalThis.fetch = (async () => {
      const r = responses[Math.min(call, responses.length - 1)];
      call++;
      return r as unknown as Response;
    }) as typeof fetch;
  }

  function withKeys(gemini: string | undefined, groq: string | undefined) {
    if (gemini) process.env.GEMINI_API_KEY = gemini;
    else delete process.env.GEMINI_API_KEY;
    if (groq) process.env.GROQ_API_KEY = groq;
    else delete process.env.GROQ_API_KEY;
  }

  try {
    await runChecks('IA : logique de fallback (fetch mocké, sans appel réseau)', [
      ['aucune clé IA → generateAiReply retourne null', async () => {
        withKeys(undefined, undefined);
        const draft = await generateAiReply('demande complexe', []);
        assert.equal(draft, null);
      }],
      ['Gemini échoue (429) → Groq prend le relais (§9)', async () => {
        withKeys('cle-gemini-test', 'cle-groq-test');
        mockFetchSequence(
          { ok: false, status: 429, json: async () => ({}) },
          { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'Réponse de secours via Groq.' } }] }) },
        );
        const draft = await generateAiReply('demande complexe', []);
        assert.ok(draft, 'une réponse doit être générée');
        assert.equal(draft.provider, 'groq');
        assert.ok(draft.text.includes('Groq'));
        assert.equal(draft.aiUsed, true);
      }],
      ['Gemini répond → pas de fallback Groq (jamais les deux en parallèle)', async () => {
        withKeys('cle-gemini-test', 'cle-groq-test');
        mockFetchSequence({
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: 'Réponse Gemini.' }] } }] }),
        });
        const draft = await generateAiReply('demande complexe', []);
        assert.ok(draft, 'une réponse doit être générée');
        assert.equal(draft.provider, 'gemini');
        assert.ok(draft.text.includes('Gemini'));
      }],
      ['Gemini ET Groq échouent → null (aucune hallucination forcée)', async () => {
        withKeys('cle-gemini-test', 'cle-groq-test');
        mockFetchSequence(
          { ok: false, status: 500, json: async () => ({}) },
          { ok: false, status: 503, json: async () => ({}) },
        );
        const draft = await generateAiReply('demande complexe', []);
        assert.equal(draft, null);
      }],
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    withKeys(prevGemini, prevGroq);
  }
}

// -----------------------------------------------------------------------------
// Section E — Limites (§10 / §11)
// -----------------------------------------------------------------------------

async function sectionLimits() {
  await runChecks('Limites d\'utilisation (rate limiting)', [
    ['longueur max de message raisonnable', () => {
      assert.ok(getMaxMessageLength() >= 100, 'longueur max raisonnable');
    }],
    ['première requête (messages + IA) autorisée pour une IP fraîche', () => {
      const ip = `test-ip-${Date.now()}`;
      assert.equal(checkAiLimits(ip).allowed, true);
      assert.equal(checkMessageLimits(ip).allowed, true);
    }],
  ]);
}

// -----------------------------------------------------------------------------
// Exécution principale
// -----------------------------------------------------------------------------

async function main() {
  await sectionIntentDetection();
  await sectionFaq();
  await sectionSearch();
  await sectionAiFallback();
  await sectionLimits();

  if (failures > 0) {
    console.error(`\n❌ ${failures} test(s) en échec sur ${totalChecks}.`);
    process.exit(1);
  }
  console.log(`\n✅ Tous les tests passent (${totalChecks} tests).`);
}

main().catch((err) => {
  console.error('Erreur inattendue du harnais de test :', err);
  process.exit(1);
});

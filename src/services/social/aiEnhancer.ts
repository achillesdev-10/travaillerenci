/**
 *  TravaillerEnCi — src/services/social/aiEnhancer.ts
 *  Amélioration IA OPTIONNELLE des textes sociaux (Gemini → fallback Groq).
 *
 *  Principes :
 *   • Désactivée par défaut (SOCIAL_AI_ENABLED=true pour activer) — les
 *     templates déterministes restent la norme, l'IA n'est appelée que si
 *     elle apporte une vraie valeur.
 *   • L'IA ne PEUT PAS inventer : le prompt interdit toute donnée absente
 *     des faits fournis, et `validateAiTextAgainstFacts` vérifie que les
 *     nombres, dates, URLs, types de contrat et diplômes mentionnés existent
 *     bien dans la publication source. En cas de doute → rejet et retour au
 *     template déterministe.
 *   • Même infrastructure que l'assistant : GEMINI_API_KEY puis GROQ_API_KEY.
 */

import type { SocialPlatform } from '@/types/social';
import { isSocialAiEnabled } from './config';
import type { SocialContentFacts } from './facts';

const AI_TIMEOUT_MS = 20_000;
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.3-70b-versatile';

export type AiProvider = 'gemini' | 'groq';

export interface AiEnhanceResult {
  text: string;
  aiUsed: boolean;
  provider: AiProvider | 'none';
}

// -----------------------------------------------------------------------------
//  Extraction de faits numériques / textuels (validation)
// -----------------------------------------------------------------------------

const FRENCH_MONTHS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** Normalise un token numérique (« 1 250 000 », « 1.250.000 », « 250000 » → « 1250000 »). */
function normalizeNumber(token: string): string {
  return token.replace(/[\s\u00A0.,']/g, '');
}

/** Tous les tokens numériques d'un texte, normalisés. */
export function extractNumbers(text: string): string[] {
  const tokens = text.match(/\d+(?:[\s\u00A0.,']\d+)*/g) || [];
  return tokens.map(normalizeNumber);
}

/** Dates françaises « 12 août 2025 » présentes dans un texte. */
export function extractFrenchDates(text: string): Array<{ day: number; month: number; year: number | null }> {
  const monthRe = FRENCH_MONTHS.join('|');
  const re = new RegExp(
    `\\b(\\d{1,2})\\s+(${monthRe})(?:\\s+(\\d{4}))?\\b`,
    'gi',
  );
  const found: Array<{ day: number; month: number; year: number | null }> = [];
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const monthIdx = FRENCH_MONTHS.findIndex(
      (month) => month.toLowerCase() === m[2].toLowerCase(),
    );
    found.push({
      day: Number(m[1]),
      month: monthIdx + 1,
      year: m[3] ? Number(m[3]) : null,
    });
  }
  return found;
}

const CONTRACT_TYPES = [
  'CDI', 'CDD', 'Stage', 'Alternance', 'Freelance', 'Prestation',
  'Temps plein', 'Temps partiel',
];

const DIPLOMA_RE =
  /\b(Bac\s*\+?\s*\d*|BTS\s*\/\s*DUT|BTS|DUT|Licence\s*Pro|Licence|Master|Doctorat|CAP\s*\/\s*BEP|CAP|BEP|BEPC|CEPE|DEUG|Ingénieur)\b/gi;

function normalizeText(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Corpus de faits autorisés (chaîne de recherche). */
function sourceFactText(facts: SocialContentFacts): string {
  return [
    facts.title,
    facts.company,
    facts.location,
    facts.contractType,
    facts.deadlineLabel,
    facts.deadline,
    facts.registrationFee,
    facts.positionsCount !== null ? String(facts.positionsCount) : '',
    facts.diplomaLevels.join(' '),
    facts.description,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Validation stricte : chaque nombre, date, URL, type de contrat et niveau de
 * diplôme présent dans le texte généré DOIT exister dans les faits source.
 * Retourne { valid: true } ou { valid: false, reason }.
 */
export function validateAiTextAgainstFacts(
  text: string,
  facts: SocialContentFacts,
  expectedUrl: string,
): { valid: boolean; reason: string | null } {
  const source = sourceFactText(facts);

  // 1. URLs : le texte ne doit contenir que l'URL attendue (ou l'URL source).
  const urlMatches = text.match(/https?:\/\/\S+/g) || [];
  for (const u of urlMatches) {
    const clean = u.replace(/[.,;:!?)\]]+$/, '');
    if (clean !== expectedUrl) {
      return { valid: false, reason: `URL non autorisée : ${clean}` };
    }
  }

  // 2. Nombres : chaque nombre du texte doit exister dans les faits source.
  //    Les URLs sont exclues (l'ID du contenu peut contenir des chiffres).
  const textWithoutUrls = text.replace(/https?:\/\/\S+/g, ' ');
  const sourceNumbers = new Set(extractNumbers(source));
  for (const n of extractNumbers(textWithoutUrls)) {
    if (!sourceNumbers.has(n)) {
      return { valid: false, reason: `Nombre non présent dans les données source : ${n}` };
    }
  }

  // 3. Dates françaises : le (jour, mois, année) doit correspondre à une
  //    date réelle de l'annonce (deadline, inscription, etc.).
  const sourceDates = extractFrenchDates(source);
  for (const d of extractFrenchDates(text)) {
    const match = sourceDates.some(
      (s) =>
        s.day === d.day &&
        s.month === d.month &&
        (d.year === null || s.year === null || s.year === d.year),
    );
    if (!match) {
      return { valid: false, reason: `Date non présente dans les données source : ${d.day}/${d.month}/${d.year ?? '?'}` };
    }
  }

  // 4. Types de contrat.
  const sourceNorm = normalizeText(source);
  for (const ct of CONTRACT_TYPES) {
    if (normalizeText(text).includes(normalizeText(ct))) {
      if (!sourceNorm.includes(normalizeText(ct))) {
        return { valid: false, reason: `Type de contrat non présent dans les données source : ${ct}` };
      }
    }
  }

  // 5. Niveaux de diplôme.
  const sourceDiplomas = new Set(
    (source.match(DIPLOMA_RE) || []).map((d) => normalizeText(d)),
  );
  for (const d of text.match(DIPLOMA_RE) || []) {
    const norm = normalizeText(d);
    if (!sourceDiplomas.has(norm)) {
      return { valid: false, reason: `Diplôme non présent dans les données source : ${d}` };
    }
  }

  return { valid: true, reason: null };
}

// -----------------------------------------------------------------------------
//  Appels IA (Gemini → Groq), miroir de src/services/assistant/aiService.ts
// -----------------------------------------------------------------------------

function buildPrompt(facts: SocialContentFacts, templateText: string, url: string): { system: string; user: string } {
  const system = `Tu es le rédacteur social de TravaillerEnCi (travaillerenci.vercel.app), une plateforme d'emploi, de stages, de bourses et de concours en Côte d'Ivoire.

RÈGLES STRICTES (non négociables) :
1. N'invente JAMAIS une information : ni salaire, ni date, ni localisation, ni entreprise, ni diplôme, ni condition, ni nombre de places, ni avantage, ni procédure, ni URL.
2. Base ton texte UNIQUEMENT sur les « FAITS DE LA PUBLICATION » fournis.
3. Tu peux uniquement reformuler, résumer, structurer et adapter le ton.
4. N'ajoute AUCUNE URL autre que celle fournie.
5. N'utilise pas de listes numérotées. Utilise des puces simples si utile.
6. Ton texte ne doit pas dépasser 500 caractères.
7. Réponds en français.`;

  const user = [
    `FAITS DE LA PUBLICATION (seule source de vérité) :`,
    `Titre : ${facts.title}`,
    facts.company ? `Entreprise / organisme : ${facts.company}` : null,
    facts.location ? `Localisation : ${facts.location}` : null,
    facts.contractType ? `Type de contrat : ${facts.contractType}` : null,
    facts.deadlineLabel ? `Date limite : ${facts.deadlineLabel}` : null,
    facts.diplomaLevels.length > 0 ? `Diplômes : ${facts.diplomaLevels.join(', ')}` : null,
    facts.positionsCount !== null ? `Nombre de places : ${facts.positionsCount}` : null,
    facts.registrationFee ? `Frais : ${facts.registrationFee}` : null,
    `URL : ${url}`,
    '',
    `TEMPLATE ACTUEL (à améliorer) :`,
    templateText,
    '',
    `Rédige une version améliorée du texte pour ${facts.type === 'exam' ? 'un concours' : 'une offre'} à publier sur les réseaux sociaux, sans ajouter de fait nouveau.`,
  ]
    .filter((l): l is string => l !== null && l !== '')
    .join('\n');

  return { system, user };
}

async function callGemini(system: string, user: string, fetchImpl: typeof fetch): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY absente');
  const res = await fetchImpl(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${system}\n\n${user}` }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 700 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .join('') || '';
  if (!text.trim()) throw new Error('Réponse Gemini vide');
  return text.trim();
}

async function callGroq(system: string, user: string, fetchImpl: typeof fetch): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY absente');
  const res = await fetchImpl(GROQ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      max_tokens: 700,
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('Réponse Groq vide');
  return text.trim();
}

/**
 * Génère le texte final : template déterministe, amélioré par l'IA UNIQUEMENT
 * si activée et si le résultat passe la validation des faits. Jamais de
 * consommation IA inutile.
 */
export async function enhanceSocialText(
  platform: SocialPlatform,
  facts: SocialContentFacts,
  templateText: string,
  url: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AiEnhanceResult> {
  if (!isSocialAiEnabled()) {
    return { text: templateText, aiUsed: false, provider: 'none' };
  }

  const { system, user } = buildPrompt(facts, templateText, url);
  const candidates: Array<{ provider: AiProvider; call: () => Promise<string> }> = [];

  if (process.env.GEMINI_API_KEY) {
    candidates.push({ provider: 'gemini', call: () => callGemini(system, user, fetchImpl) });
  }
  if (process.env.GROQ_API_KEY) {
    candidates.push({ provider: 'groq', call: () => callGroq(system, user, fetchImpl) });
  }

  for (const candidate of candidates) {
    try {
      const text = await candidate.call();
      const check = validateAiTextAgainstFacts(text, facts, url);
      if (check.valid) {
        return { text, aiUsed: true, provider: candidate.provider };
      }
      // Texte invalide → on tente le fournisseur suivant, sinon template.
    } catch {
      // Erreur API / timeout → fournisseur suivant.
    }
  }

  return { text: templateText, aiUsed: false, provider: 'none' };
}

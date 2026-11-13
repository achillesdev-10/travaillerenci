import type { AiNewsDraft, NewsCluster } from '@/types/news';
import { NEWS_CATEGORY_LABELS } from './categories';

interface SourceText {
  name: string;
  url: string;
  published_at: string | null;
  text: string;
}

const PROVIDER_COOLDOWN_MS = 10 * 60 * 1000;
const providerDownUntil = new Map<string, number>();

function providerAvailable(name: string): boolean {
  const until = providerDownUntil.get(name) ?? 0;
  return Date.now() >= until;
}

function markProviderDown(name: string) {
  providerDownUntil.set(name, Date.now() + PROVIDER_COOLDOWN_MS);
}

function buildPrompt(cluster: NewsCluster, sources: SourceText[]): string {
  const categoryList = Object.values(NEWS_CATEGORY_LABELS).join(', ');
  const dossier = sources
    .map(
      (source, index) =>
        `SOURCE ${index + 1}\n` +
        `Média : ${source.name}\n` +
        `URL : ${source.url}\n` +
        `Date : ${source.published_at ?? 'non précisée'}\n` +
        `Extrait :\n${source.text.slice(0, 3500)}\n`,
    )
    .join('\n');

  return `Tu es journaliste rédacteur pour TravaillerEnCi, média ivoirien spécialisé dans l'emploi, l'économie, la formation et l'entrepreneuriat.

MISSION : rédiger un article ORIGINAL en français à partir des sources ci-dessous.

RÈGLES ABSOLUES :
- N'invente aucun chiffre, nom, citation, date ou déclaration.
- Utilise uniquement les faits présents dans les sources fournies.
- Si les sources sont insuffisantes, contradictoires ou trop vagues, réponds "can_publish": false.
- Reformule entièrement : ne recopie aucune phrase des sources.
- Attribue les faits aux médias cités ("selon RFI Afrique", "d'après l'AIP").
- Aucune diffamation, aucun jugement de valeur, aucun sensationnalisme.
- Titre original de 60 à 100 caractères, sans point final.
- Résumé factuel de 140 à 220 caractères.
- Article de 450 à 700 mots, structuré en Markdown avec 2 à 4 titres "## ".
- Termine par un court paragraphe "## Sources" listant les médias utilisés (sans URL dans le corps).
- Catégorie obligatoire parmi : ${categoryList}.
- "confidence" entre 0 et 1 : ta confiance dans la véracité et la complétude.
- "used_source_urls" : uniquement les URL réellement utilisées, copiées depuis les sources.
- "facts" : 3 à 6 faits clés, chacun avec sa source.

SUJET DÉTECTÉ : ${cluster.title}
CATÉGORIE PROBABLE : ${cluster.category}

${dossier}

Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour :
{
  "can_publish": true,
  "confidence": 0.82,
  "title": "...",
  "excerpt": "...",
  "content": "## ...\\n\\n...",
  "category": "...",
  "seo_title": "...",
  "seo_description": "...",
  "seo_keywords": "mot1, mot2, mot3",
  "used_source_urls": ["..."],
  "facts": ["Fait 1 — Source", "Fait 2 — Source"],
  "warnings": []
}`;
}

function extractJson(text: string): unknown | null {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeDraft(raw: unknown, allowedUrls: string[]): AiNewsDraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (value.can_publish === false) return null;

  const title = String(value.title ?? '').replace(/\s+/g, ' ').trim();
  const excerpt = String(value.excerpt ?? '').replace(/\s+/g, ' ').trim();
  const content = String(value.content ?? '').trim();
  if (title.length < 20 || excerpt.length < 40 || content.length < 500) return null;

  const confidenceRaw = Number(value.confidence);
  const confidence = Number.isFinite(confidenceRaw)
    ? Math.min(1, Math.max(0, confidenceRaw))
    : 0.5;

  const used = Array.isArray(value.used_source_urls)
    ? value.used_source_urls
        .map((url) => String(url))
        .filter((url) => allowedUrls.includes(url))
    : [];

  return {
    can_publish: true,
    confidence,
    title: title.slice(0, 140),
    excerpt: excerpt.slice(0, 260),
    content,
    category: String(value.category ?? 'societe'),
    seo_title: String(value.seo_title ?? title).slice(0, 70),
    seo_description: String(value.seo_description ?? excerpt).slice(0, 170),
    seo_keywords: String(value.seo_keywords ?? '').slice(0, 200),
    used_source_urls: used.length > 0 ? used : allowedUrls.slice(0, 2),
    facts: Array.isArray(value.facts)
      ? value.facts.map((fact) => String(fact)).slice(0, 8)
      : [],
    warnings: Array.isArray(value.warnings)
      ? value.warnings.map((warning) => String(warning)).slice(0, 5)
      : [],
  };
}

async function callGemini(prompt: string): Promise<unknown | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !providerAvailable('gemini')) return null;

  const model = process.env.NEWS_AI_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2600,
            responseMimeType: 'application/json',
          },
        }),
        signal: AbortSignal.timeout(25_000),
      },
    );
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) markProviderDown('gemini');
      return null;
    }
    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return extractJson(text);
  } catch {
    markProviderDown('gemini');
    return null;
  }
}

interface OpenAiCompatibleConfig {
  name: string;
  url: string;
  key: string | undefined;
  model: string;
}

async function callOpenAiCompatible(
  config: OpenAiCompatibleConfig,
  prompt: string,
): Promise<unknown | null> {
  if (!config.key || !providerAvailable(config.name)) return null;
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.key}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0.3,
        max_tokens: 2600,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'Tu es un journaliste factuel. Tu réponds uniquement en JSON valide, sans texte autour.',
          },
          { role: 'user', content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!response.ok) {
      if (response.status === 429 || response.status >= 500) markProviderDown(config.name);
      return null;
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return extractJson(data.choices?.[0]?.message?.content || '');
  } catch {
    markProviderDown(config.name);
    return null;
  }
}

export interface NewsDraftResult {
  draft: AiNewsDraft;
  /** Modèle qui a réellement produit le brouillon (traçabilité). */
  model: string;
}

/**
 * Un seul appel IA par sujet retenu. Le repli éventuel n'intervient que si le
 * fournisseur principal échoue techniquement (pas de nouvel essai métier).
 */
export async function generateNewsDraft(
  cluster: NewsCluster,
  sources: SourceText[],
): Promise<NewsDraftResult | null> {
  if (sources.length === 0) return null;
  const prompt = buildPrompt(cluster, sources);
  const allowedUrls = sources.map((source) => source.url);

  let model = process.env.NEWS_AI_MODEL || process.env.GEMINI_MODEL || 'gemini-flash-latest';
  let raw = await callGemini(prompt);

  if (!raw) {
    model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
    raw = await callOpenAiCompatible(
      {
        name: 'groq',
        url: 'https://api.groq.com/openai/v1/chat/completions',
        key: process.env.GROQ_API_KEY,
        model,
      },
      prompt,
    );
  }

  if (!raw) {
    model = process.env.CEREBRAS_MODEL || 'llama3.1-8b';
    raw = await callOpenAiCompatible(
      {
        name: 'cerebras',
        url: 'https://api.cerebras.ai/v1/chat/completions',
        key: process.env.CEREBRAS_API_KEY,
        model,
      },
      prompt,
    );
  }

  const draft = normalizeDraft(raw, allowedUrls);
  return draft ? { draft, model } : null;
}

export type { SourceText };

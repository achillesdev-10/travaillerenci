import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.ASSISTANT_GROQ_MODEL || 'qwen/qwen3.8-27b';

const SYSTEM_PROMPT = `Tu es un expert RH et rédacteur professionnel spécialisé dans le marché de l'emploi en Côte d'Ivoire pour la plateforme TravaillerenCi.

Ton rôle : rédiger une lettre de motivation personnalisée et percutante pour un candidat ivoirien.

Règles strictes :
1. La lettre doit être en français professionnel, adapté au marché ivoirien.
2. Structure : En-tête (expéditeur/destinataire), Objet, Corps de lettre (3-4 paragraphes), Formule de politesse.
3. Le premier paragraphe mentionne le poste visé et l'entreprise.
4. Le deuxième paragraphe met en avant les compétences et expériences pertinentes.
5. Le troisième paragraphe explique la motivation et l'adéquation avec l'entreprise.
6. Le dernier paragraphe propose un entretien.
7. Ton : professionnel, enthousiaste mais pas familier.
8. Longueur : 250-400 mots.
9. N'invente PAS de faits ou de compétences non mentionnés par le candidat.
10. Ne mentionne JAMAIS que tu es une IA.
11. Adapte la lettre au contexte culturel ivoirien.

Réponds UNIQUEMENT la lettre de motivation, sans balises Markdown, sans commentaires.`;

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.7, maxOutputTokens: 1500 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Erreur Gemini (${res.status}) : ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const result: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .join('') || '';
  if (!result.trim()) throw new Error('Réponse IA vide.');
  return result.trim();
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });

  if (!res.ok) throw new Error(`Erreur Groq (${res.status})`);

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content || '';
  if (!text.trim()) throw new Error('Réponse IA vide.');
  return text.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyName, jobTitle, candidateName, skills, experience, motivation } = body;

    if (typeof companyName !== 'string' || typeof jobTitle !== 'string') {
      return NextResponse.json(
        { error: 'Les champs "companyName" et "jobTitle" sont requis.' },
        { status: 400 }
      );
    }

    const prompt = [
      `Rédige une lettre de motivation pour :`,
      ``,
      `Poste visé : ${jobTitle}`,
      `Entreprise : ${companyName}`,
      candidateName ? `Nom du candidat : ${candidateName}` : '',
      skills ? `Compétences clés : ${skills}` : '',
      experience ? `Expérience pertinente : ${experience}` : '',
      motivation ? `Motivation du candidat : ${motivation}` : '',
      ``,
      `Rédige la lettre de motivation complète.`,
    ]
      .filter((line) => line !== '')
      .join('\n');

    const hasGemini = Boolean(process.env.GEMINI_API_KEY);
    const hasGroq = Boolean(process.env.GROQ_API_KEY);

    if (!hasGemini && !hasGroq) {
      return NextResponse.json(
        {
          error: 'Aucune clé IA configurée. Ajoutez GEMINI_API_KEY ou GROQ_API_KEY.',
        },
        { status: 409 }
      );
    }

    let result = '';
    let provider = '';

    if (hasGemini) {
      try {
        result = await callGemini(prompt, process.env.GEMINI_API_KEY!);
        provider = 'gemini';
      } catch {
        // fallback to Groq
      }
    }

    if (!result && hasGroq) {
      try {
        result = await callGroq(prompt, process.env.GROQ_API_KEY!);
        provider = 'groq';
      } catch {
        // both failed
      }
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Impossible de générer la lettre. Veuillez réessayer.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ result, provider });
  } catch (err) {
    console.error('POST /api/ai/cover-letter error:', err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'Erreur lors de la génération.',
      },
      { status: 500 }
    );
  }
}

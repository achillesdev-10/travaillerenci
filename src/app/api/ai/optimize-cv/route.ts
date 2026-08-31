import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `Tu es un expert RH spécialisé dans le marché de l'emploi en Côte d'Ivoire pour la plateforme travaillerenci.
Tu dois optimiser le texte d'un CV (accroche professionnelle, description d'expérience, etc.) afin de le rendre plus percutant pour les recruteurs ivoiriens.

Règles strictes :
1. Corrige toutes les fautes d'orthographe et de grammaire en français.
2. Utilise des verbes d'action percutants et professionnels (ex: "Piloter", "Concevoir", "Optimiser", "Mener à bien", "Gérer", "Coordonner", etc.).
3. Rends le texte plus attrayant et quantifiable quand possible (ajoute des chiffres si le contexte s'y prête, sans inventer).
4. Adapte le langage au marché de l'emploi ivoirien : professionnel, dynamique, valorisant les compétences recherchées par les entreprises en Côte d'Ivoire.
5. Ne mentionne PAS explicitement le fait que tu as réécrit le texte.
6. Ne réponds QUE le texte optimisé, sans aucune introduction ni conclusion.
7. Garde la longueur similaire à l'original, sans exagérer.
8. Si le texte est vide ou très court, propose une version adaptée et pertinente au poste visé.

Réponds UNIQUEMENT le texte optimisé, sans balises Markdown, sans commentaires.`;

async function callGemini(text: string, jobTitle: string, apiKey: string): Promise<string> {
  const prompt = `${SYSTEM_PROMPT}\n\nPoste visé : ${jobTitle}\n\n--- Texte à optimiser ---\n${text}\n\n--- Texte optimisé ---`;

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 1024 },
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

export async function POST(request: NextRequest) {
  try {
    const { text, jobTitle } = await request.json();

    if (typeof text !== 'string' || typeof jobTitle !== 'string') {
      return NextResponse.json(
        { error: 'Champs invalides : text et jobTitle sont requis (string).' },
        { status: 400 }
      );
    }

    const cappedText = text.slice(0, 4000);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Aucune clé IA configurée. Ajoutez la variable GEMINI_API_KEY pour activer l'optimisation IA.",
        },
        { status: 409 }
      );
    }

    const optimized = await callGemini(cappedText, jobTitle, apiKey);
    return NextResponse.json({ result: optimized });
  } catch (err) {
    console.error('POST /api/ai/optimize-cv error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Impossible d'optimiser ce texte.",
      },
      { status: 500 }
    );
  }
}

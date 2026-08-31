import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';

/**
 * Réécriture IA (optionnelle) d'une description scrapée.
 *
 * Aucune clé IA n'est fournie → 409 avec un message clair (le bouton reste
 * visible mais désactivé côté UI, ou affiche le message).
 *
 * La clé `GEMINI_API_KEY` doit être définie côté serveur (Vercel) :
 * https://aistudio.google.com/apikey — modèle gemini-flash-latest via REST
 * (aucun SDK à installer).
 */

const GEMINI_MODEL = 'gemini-flash-latest';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `Tu es un rédacteur d'annonces d'emploi expert pour la Côte d'Ivoire.
À partir d'une description d'offre d'emploi brute (scrapée d'un site), réécris-la en Markdown propre et structuré en français.

Règles strictes :
- Structure : "## À propos du poste", "## Missions", "## Profil recherché", "## Comment postuler".
- Ne garde QUE les informations présentes dans le texte source : n'invente JAMAIS de missions, d'exigences, de salaire ou de coordonnées.
- Retire tout le bruit : navigation, publicités, "Postuler", "Partager", compteurs de vues, avis de sécurité, listes d'autres offres, liens.
- Convertis les listes en puces "- " ; conserve les emails de candidature.
- Français correct, phrases concises, aucun commentaire méta (ne dis pas "voici la réécriture").
- Maximum 800 mots.`;

async function callGemini(title: string, company: string, description: string, apiKey: string): Promise<string> {
  const prompt = `${SYSTEM_PROMPT}\n\nTitre : ${title}\nEntreprise : ${company}\n\n--- Description brute ---\n${description}\n\n--- Réécriture ---`;

  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 2048 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Erreur Gemini (${res.status}) : ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: { text?: string }) => p.text || '')
      .join('') || '';
  if (!text.trim()) throw new Error('Réponse IA vide.');
  return text.trim();
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  try {
    const { title, company, description } = await request.json();

    if (typeof title !== 'string' || typeof company !== 'string' || typeof description !== 'string') {
      return NextResponse.json(
        { error: 'Champs invalides : title, company et description sont requis.' },
        { status: 400 }
      );
    }

    // Borne la description envoyée au modèle (coût / latence).
    const cappedDescription = description.slice(0, 8000);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'Aucune clé IA configurée. Ajoutez la variable GEMINI_API_KEY dans Vercel pour activer la réécriture IA (gratuite via Google AI Studio).',
        },
        { status: 409 }
      );
    }

    const rewritten = await callGemini(title, company, cappedDescription, apiKey);
    return NextResponse.json({ ok: true, rewritten });
  } catch (err) {
    console.error('POST /api/admin/jobs/ai-rewrite error:', err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Impossible de réécrire cette description.',
      },
      { status: 500 }
    );
  }
}

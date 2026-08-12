import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getClientIp } from '@/lib/rateLimit';
import { detectIntent } from '@/services/assistant/intentDetector';
import { searchOpportunities, seeMoreUrlFor } from '@/services/assistant/searchService';
import { getFaqReply } from '@/services/assistant/faqService';
import { generateAiReply } from '@/services/assistant/aiService';
import { checkAiLimits, checkMessageLimits, getMaxMessageLength } from '@/services/assistant/rateLimiter';
import type { AssistantHistoryMessage } from '@/services/assistant/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Nombre max de messages d'historique renvoyés (contexte léger, pas de stockage). */
const MAX_HISTORY = 8;

/** Validation du message : type, longueur, contenu exploitable. */
function validateMessage(raw: unknown): { ok: true; message: string } | { ok: false; error: string; status: number } {
  if (typeof raw !== 'string') {
    return { ok: false, error: 'Message invalide.', status: 400 };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'Veuillez écrire un message.', status: 400 };
  }
  const maxLen = getMaxMessageLength();
  if (trimmed.length > maxLen) {
    return {
      ok: false,
      error: `Message trop long (${maxLen} caractères maximum).`,
      status: 400,
    };
  }
  return { ok: true, message: trimmed };
}

/** Nettoie l'historique client : ne garde que les rôles connus et un texte court. */
function sanitizeHistory(raw: unknown): AssistantHistoryMessage[] {
  if (!Array.isArray(raw)) return [];
  const maxLen = getMaxMessageLength();
  const out: AssistantHistoryMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if (role !== 'user' && role !== 'assistant') continue;
    if (typeof content !== 'string' || !content.trim()) continue;
    out.push({ role, content: content.slice(0, maxLen) });
  }
  return out.slice(-MAX_HISTORY);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);

  // 1. Limites de messages (par IP).
  const limit = checkMessageLimits(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: limit.error }, { status: 429 });
  }

  // 2. Lecture + validation du corps.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const validation = validateMessage((body as { message?: unknown })?.message);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: validation.status });
  }
  const message = validation.message;
  const history = sanitizeHistory((body as { history?: unknown })?.history);

  try {
    // 3. Détection d'intention déterministe.
    const intent = detectIntent(message);

    // 4. FAQ — réponse prédéfinie.
    if (intent.kind === 'faq' && intent.faqKey) {
      const faqReply = getFaqReply(intent.faqKey);
      if (faqReply) {
        return NextResponse.json({ reply: faqReply });
      }
    }

    // 5. Recherche directe en base (rapide, sans IA).
    if (intent.kind === 'search' && intent.search) {
      const { results, total, dominant } = await searchOpportunities(intent.search);
      const seeMoreUrl = seeMoreUrlFor(intent.search, dominant);

      if (results.length > 0) {
        // Libellé singulier avec article correct (genre du mot).
        const categoryLabel =
          dominant === 'scholarship'
            ? 'une bourse'
            : dominant === 'exam'
              ? 'un concours'
              : dominant === 'internship'
                ? 'un stage'
                : 'une offre';
        const text =
          total > results.length
            ? `J'ai trouvé ${total} ${categoryLabel.replace(/^(une|un) /, '')}${total > 1 ? 's' : ''} correspondant${total > 1 ? 's' : ''} à votre recherche. Voici les meilleurs résultats :`
            : results.length === 1
              ? `J'ai trouvé ${categoryLabel} correspondant à votre recherche :`
              : `J'ai trouvé ${results.length} ${categoryLabel.replace(/^(une|un) /, '')}${results.length > 1 ? 's' : ''} correspondant${results.length > 1 ? 's' : ''} à votre recherche. Voici les meilleurs résultats :`;
        return NextResponse.json({ reply: { text, results, seeMoreUrl, aiUsed: false } });
      }

      // Aucun résultat → réponse honnête + orientation.
      return NextResponse.json({
        reply: {
          text: [
            'Je n\'ai trouvé aucune opportunité correspondant exactement à votre recherche.',
            '',
            'Vous pouvez essayer :',
            '• une autre ville ;',
            '• une autre catégorie (emploi, stage, bourse ou concours) ;',
            '• un autre domaine ou mot-clé.',
          ].join('\n'),
          results: [],
          seeMoreUrl,
          aiUsed: false,
        },
      });
    }

    // 6. Demande complexe → IA (Gemini puis Groq), avec limites IA.
    const aiLimit = checkAiLimits(ip);
    if (!aiLimit.allowed) {
      return NextResponse.json({ error: aiLimit.error }, { status: 429 });
    }

    // On cherche d'abord en base un contexte utile pour l'IA (jamais inventé).
    const { results } = await searchOpportunities({ categories: [], keywords: [message] });
    const draft = await generateAiReply(message, results, history);

    if (!draft) {
      return NextResponse.json({
        reply: {
          text: [
            'Je n\'ai pas trouvé cette information dans les données actuellement disponibles sur TravaillerEnCI.',
            '',
            'Vous pouvez aussi parcourir nos sections : /jobs, /bourses, /concours, ou créer votre CV sur /generateur-de-cv.',
          ].join('\n'),
          results,
          aiUsed: false,
        },
      });
    }

    return NextResponse.json({
      reply: { text: draft.text, results, aiUsed: draft.aiUsed },
    });
  } catch (err) {
    // Erreur contrôlée : jamais de stack trace ni de détail interne.
    console.error('[assistant] erreur pipeline :', err);
    return NextResponse.json(
      {
        error:
          'Désolé, je rencontre actuellement un problème pour récupérer les opportunités. Veuillez réessayer dans quelques instants.',
      },
      { status: 500 },
    );
  }
}

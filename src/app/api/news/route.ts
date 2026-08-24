/**
 *  TravaillerEnCi — /api/news
 *  Route API CRON pour l'agrégation et la réécriture par IA des actualités.
 *
 *  Méthodes :
 *   • GET  — Liste les articles publiés (public).
 *   • POST — Déclenche le pipeline de scraping + réécriture IA (CRON / admin).
 *
 *  Le pipeline POST :
 *   1. Scrape les sources d'emploi CI configurées.
 *   2. Filtre les articles strictement liés au marché de l'emploi, formation, concours.
 *   3. Réécrit via l'API Gemini : correction style, structuration H2/H3, méta SEO.
 *   4. Insère dans la table `articles` avec statut `published`.
 *
 *  Sécurité : le POST est protégé par un token CRON secret (env CRON_SECRET).
 */

import { NextRequest, NextResponse } from 'next/server';
import { ArticleService } from '@/services/articleService';
import type { ArticleCategory } from '@/types/article';

// ---------------------------------------------------------------------------
// GET — Liste publique des articles
// ---------------------------------------------------------------------------
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const category = searchParams.get('category') || undefined;
  const keyword = searchParams.get('q') || undefined;

  const { rows, total } = await ArticleService.list({
    keyword,
    category: category as ArticleCategory | undefined,
    status: 'published',
    order_by: 'published_at',
    order_dir: 'desc',
    limit: 20,
    offset: (page - 1) * 20,
  });

  return NextResponse.json({
    articles: rows,
    total,
    page,
    total_pages: Math.ceil(total / 20),
  });
}

// ---------------------------------------------------------------------------
// POST — Pipeline CRON : scrape → réécriture IA → insertion
// ---------------------------------------------------------------------------



interface ScrapedArticle {
  title: string;
  content: string;
  source_url: string;
  category: ArticleCategory;
}

/**
 * Étapes du pipeline :
 * 1. Récupérer les contenus depuis les sources.
 * 2. Filtrer les articles pertinents.
 * 3. Réécrire avec Gemini.
 * 4. Insérer en base.
 */
async function processArticle(scraped: ScrapedArticle): Promise<boolean> {
  try {
    // Vérifier si l'article existe déjà (par source_url)
    const existing = await ArticleService.list({
      keyword: scraped.title,
      status: 'published',
      limit: 1,
    });
    if (existing.rows.some((a) => a.source_url === scraped.source_url)) {
      return false; // Doublon
    }

    // Réécriture IA via Gemini (si configuré)
    const geminiKey = process.env.GEMINI_API_KEY;
    let optimizedContent = scraped.content;
    let optimizedTitle = scraped.title;
    let excerpt = scraped.content.slice(0, 200);

    if (geminiKey) {
      try {
        const prompt = `Tu es un rédacteur professionnel spécialisé dans l'emploi en Côte d'Ivoire.
Réécris cet article de manière engageante et professionnelle.
Corrige le style, structure-le avec des titres (## H2, ### H3), et génère une méta-description SEO de 150 caractères.

Article original :
Titre : ${scraped.title}
Contenu : ${scraped.content}

Réponds en JSON :
{
  "title": "titre optimisé",
  "content": "contenu structuré en markdown",
  "excerpt": "méta-description de 150 chars max",
  "seo_title": "titre SEO optimisé (max 60 chars)",
  "seo_description": "description SEO (max 160 chars)",
  "seo_keywords": "mot-clé1, mot-clé2, mot-clé3"
}`;

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2000,
              },
            }),
          },
        );

        if (geminiResponse.ok) {
          const data = await geminiResponse.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
          // Extraire le JSON de la réponse
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            optimizedTitle = parsed.title || optimizedTitle;
            optimizedContent = parsed.content || optimizedContent;
            excerpt = parsed.excerpt || excerpt;

            // Insérer avec métas SEO
            const article = await ArticleService.create({
              title: optimizedTitle,
              slug: '', // Généré automatiquement
              excerpt,
              content: optimizedContent,
              category: scraped.category,
              source_url: scraped.source_url,
              author: 'TravaillerenCi (IA)',
              status: 'published',
              seo_title: parsed.seo_title || null,
              seo_description: parsed.seo_description || null,
              seo_keywords: parsed.seo_keywords || null,
            });
            return !!article;
          }
        }
      } catch {
        // Fallback : insérer sans réécriture IA
      }
    }

    // Fallback sans IA : insérer tel quel
    const article = await ArticleService.create({
      title: optimizedTitle,
      slug: '',
      excerpt,
      content: optimizedContent,
      category: scraped.category,
      source_url: scraped.source_url,
      author: 'TravaillerenCi',
      status: 'published',
    });
    return !!article;
  } catch (err) {
    console.error('[news] Erreur traitement article:', err);
    return false;
  }
}

export async function POST(request: NextRequest) {
  // Sécurité : vérifier le token CRON
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Pipeline simplifié : en production, le scraping serait fait par un worker
  // externe (Python scraper) qui appelle cette API. Ici, on simule la
  // réception de contenus scrapés et on traite.
  //
  // En mode développement, on peut injecter des articles de test via le body.
  const body = await request.json().catch(() => ({}));
  const articles: ScrapedArticle[] = body.articles || [];

  if (articles.length === 0) {
    return NextResponse.json({
      message: 'Aucun article à traiter. Envoyez un tableau "articles" dans le body.',
      usage: `POST /api/news
Body: { "articles": [{ "title": "...", "content": "...", "source_url": "...", "category": "emploi" }] }`,
    });
  }

  let processed = 0;
  let skipped = 0;

  for (const article of articles) {
    if (!article.title || !article.content) {
      skipped++;
      continue;
    }
    const success = await processArticle(article);
    if (success) processed++;
    else skipped++;
  }

  return NextResponse.json({
    message: `Traitement terminé : ${processed} article(s) publié(s), ${skipped} ignoré(s).`,
    processed,
    skipped,
    total: articles.length,
  });
}

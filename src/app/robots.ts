import type { MetadataRoute } from 'next';
import { getSiteUrl } from '@/lib/site';

/**
 * robots.ts — économise le CPU Vercel (quota gratuit à 94 %) :
 *  1. Les robots SEO publicitaires / IA (Ahrefs, Semrush, MJ12, DotBot, GPTBot…)
 *     rampent massivement sans jamais apporter de visiteurs : bloqués en
 *     frontière. NB : robots.txt est une règle de courtoisie — les robots
 *     malveillants l'ignorent ; le blocage réel passe par le Firewall Vercel
 *     (cf. rapport de mission).
 *  2. Les URLs avec query string (?q=, ?city=, ?page=…) sont interdites :
 *     ce sont des variantes infinies non indexables (les pages de liste
 *     filtrées sont volontairement dynamiques) — ne pas les faire rendre.
 *     Le sitemap ne référence que des URLs propres.
 */
export default function robots(): MetadataRoute.Robots {
  const blockedBots = [
    // Robots SEO / outils de référencement (crawl massif, zéro visiteur)
    'AhrefsBot',
    'SemrushBot',
    'MJ12bot',
    'DotBot',
    'BLEXBot',
    'SerpstatBot',
    // Crawlers d'entraînement / collecte IA
    'GPTBot',
    'CCBot',
    'ClaudeBot',
    'anthropic-ai',
    'Google-Extended',
    'Bytespider',
    'Amazonbot',
  ];

  return {
    rules: [
      ...blockedBots.map((userAgent) => ({
        userAgent,
        disallow: '/',
      })),
      {
        userAgent: '*',
        allow: '/',
        // `/*?` : toute URL avec query string (filtres, pagination, recherche).
        // `Disallow: /api/` et `/dashboard` : déjà en place, conservés.
        disallow: ['/api/', '/dashboard', '/*?'],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}

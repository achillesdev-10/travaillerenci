import { createHash } from 'node:crypto';
import type { NewsCluster, RssItem } from '@/types/news';

const STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'l', 'au', 'aux',
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi', 'dont',
  'ou', 'a', 'à', 'en', 'dans', 'sur', 'sous', 'avec', 'sans', 'pour', 'par',
  'vers', 'chez', 'entre', 'est', 'sont', 'ete', 'etre', 'avoir', 'fait',
  'faire', 'plus', 'moins', 'apres', 'avant', 'ce', 'cet', 'cette', 'ces',
  'son', 'sa', 'ses', 'leur', 'leurs', 'il', 'elle', 'ils', 'elles', 'on',
  'nous', 'vous', 'je', 'tu', 'se', 'ne', 'pas', 'y', 'the', 'of', 'and',
]);

export function stripDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function normalizeTitle(title: string): string {
  let value = title.replace(/\s+/g, ' ').trim();
  // Google News ajoute « - Nom du média » au titre.
  value = value.replace(/\s[-–—|]\s[^-–—|]{2,40}$/, '');
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(title: string): string[] {
  return normalizeTitle(title)
    .split(' ')
    .filter((token) => token.length > 2 && !STOPWORDS.has(token));
}

export function hashText(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

/** Clé de sujet stable : évite un second appel IA pour le même événement. */
export function buildTopicKey(title: string): string {
  const tokens = Array.from(new Set(tokenize(title))).sort().slice(0, 8);
  return hashText(tokens.join(' ')).slice(0, 32);
}

export function buildContentHash(title: string, content: string): string {
  return hashText(`${normalizeTitle(title)}|${normalizeTitle(content).slice(0, 2000)}`);
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    url.hash = '';
    for (const key of Array.from(url.searchParams.keys())) {
      if (
        /^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|source|campaign|igshid)/i.test(key)
      ) {
        url.searchParams.delete(key);
      }
    }
    url.hostname = url.hostname.toLowerCase();
    let value = url.toString().replace(/\/$/, '');
    return value;
  } catch {
    return rawUrl.trim();
  }
}

export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function isRecentPublication(
  publishedAt: string | null,
  maxAgeHours: number,
): boolean {
  if (!publishedAt) return true;
  const time = Date.parse(publishedAt);
  if (Number.isNaN(time)) return true;
  const age = Date.now() - time;
  if (age < -60 * 60 * 1000) return false; // date future de plus d'une heure
  return age <= maxAgeHours * 60 * 60 * 1000;
}

/**
 * Regroupe les éléments RSS qui parlent du même événement.
 * Greedy O(n²) volontairement borné : au plus quelques dizaines d'items.
 */
export function clusterNewsItems(items: RssItem[], maxClusters = 10): NewsCluster[] {
  const clusters: Array<{ items: RssItem[]; tokens: string[]; title: string }> = [];

  for (const item of items) {
    const tokens = tokenize(item.title);
    let target: (typeof clusters)[number] | null = null;
    let bestScore = 0;

    for (const cluster of clusters) {
      const similarity = jaccard(tokens, cluster.tokens);
      const sameNormalized = normalizeTitle(item.title) === normalizeTitle(cluster.title);
      const score = sameNormalized ? 1 : similarity;
      if (score >= 0.5 && score > bestScore) {
        bestScore = score;
        target = cluster;
      }
    }

    if (target) {
      target.items.push(item);
    } else {
      clusters.push({ items: [item], tokens, title: item.title });
    }
  }

  const now = Date.now();
  return clusters
    .map((cluster) => {
      const sources = new Set(cluster.items.map((item) => item.source_id));
      const weights = cluster.items.reduce(
        (sum, item) => sum + Math.max(1, item.source_weight),
        0,
      );
      const newest = cluster.items.reduce((latest, item) => {
        const time = item.published_at ? Date.parse(item.published_at) : 0;
        return Number.isFinite(time) ? Math.max(latest, time) : latest;
      }, 0);
      const freshnessHours = newest > 0 ? Math.max(0, (now - newest) / 3_600_000) : 72;
      const score = weights * 10 + sources.size * 8 - Math.min(freshnessHours, 72);
      const representative = cluster.items.reduce((best, item) =>
        item.title.length > best.title.length ? item : best,
      );
      return {
        topic_key: buildTopicKey(representative.title),
        title: representative.title,
        category: representative.category,
        items: cluster.items,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxClusters);
}

export function normalizeForSearch(value: string): string {
  return stripDiacritics(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

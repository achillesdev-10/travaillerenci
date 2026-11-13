import type { NewsSource, RssItem } from '@/types/news';
import {
  buildTopicKey,
  hashText,
  isRecentPublication,
  normalizeTitle,
  normalizeUrl,
} from './dedupe';
import { guessNewsCategory } from './categories';

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  laquo: '«',
  raquo: '»',
  eacute: 'é',
  egrave: 'è',
  agrave: 'à',
  ccedil: 'ç',
  ugrave: 'ù',
  icirc: 'î',
  ocirc: 'ô',
  ecirc: 'ê',
  acirc: 'â',
};

export function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#([0-9]+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[String(name).toLowerCase()] ?? match);
}

export function stripHtml(value: string): string {
  return decodeXml(value)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstTag(block: string, names: string[]): string {
  for (const name of names) {
    const regex = new RegExp(
      `<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,
      'i',
    );
    const match = block.match(regex);
    if (match) {
      const value = decodeXml(match[1]).trim();
      if (value) return value;
    }
  }
  return '';
}

function atomLink(block: string): string {
  const linkTags = block.match(/<link\b[^>]*>/gi) || [];
  for (const tag of linkTags) {
    const href = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    const rel = tag.match(/rel\s*=\s*["']([^"']+)["']/i);
    if (href && (!rel || rel[1].toLowerCase() === 'alternate')) {
      return decodeXml(href[1]).trim();
    }
  }
  return firstTag(block, ['link']);
}

function enclosureUrl(block: string): string | null {
  const patterns = [
    /<enclosure\b[^>]*url\s*=\s*["']([^"']+)["']/i,
    /<media:content\b[^>]*url\s*=\s*["']([^"']+)["']/i,
    /<media:thumbnail\b[^>]*url\s*=\s*["']([^"']+)["']/i,
  ];
  for (const pattern of patterns) {
    const match = block.match(pattern);
    if (match) return decodeXml(match[1]).trim();
  }
  return null;
}

function parseDate(block: string): string | null {
  const raw = firstTag(block, ['pubDate', 'dc:date', 'published', 'updated', 'date']);
  if (!raw) return null;
  const time = Date.parse(raw);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function extractItems(xml: string): string[] {
  const rssItems = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) || [];
  const atomEntries = xml.match(/<entry\b[^>]*>[\s\S]*?<\/entry>/gi) || [];
  return [...rssItems, ...atomEntries];
}

/** Parseur RSS/Atom minimaliste — aucune dépendance, adapté aux flux d'actualité. */
export function parseRssFeed(
  xml: string,
  source: NewsSource,
  options: { maxItems?: number; maxAgeHours?: number } = {},
): RssItem[] {
  const maxItems = Math.min(options.maxItems ?? 25, 60);
  const maxAgeHours = options.maxAgeHours ?? 48;
  const items: RssItem[] = [];
  const seen = new Set<string>();

  for (const block of extractItems(xml).slice(0, maxItems * 2)) {
    const title = stripHtml(firstTag(block, ['title']));
    const url = normalizeUrl(atomLink(block));
    if (!title || !url || seen.has(url)) continue;

    const publishedAt = parseDate(block);
    if (!isRecentPublication(publishedAt, maxAgeHours)) continue;

    const summary = stripHtml(
      firstTag(block, ['description', 'content:encoded', 'summary', 'content']),
    ).slice(0, 2500);
    const imageUrl = enclosureUrl(block);
    const titleNormalized = normalizeTitle(title);

    seen.add(url);
    items.push({
      source_id: source.id,
      source_name: source.name,
      source_weight: source.weight,
      allowed_for_citation: source.allowed_for_citation,
      title,
      url,
      summary,
      published_at: publishedAt,
      image_url: imageUrl,
      guid: firstTag(block, ['guid', 'id']) || null,
      url_key: hashText(url),
      title_hash: hashText(titleNormalized),
      title_normalized: titleNormalized,
      category: guessNewsCategory(title, summary),
      topic_key: buildTopicKey(title),
    });

    if (items.length >= maxItems) break;
  }

  return items;
}

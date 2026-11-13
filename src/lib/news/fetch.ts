import { decodeXml } from './rss';

const USER_AGENT =
  'TravaillerEnCI-NewsBot/1.0 (+https://travaillerenci.vercel.app; contact: redaction@travaillerenci.ci)';

interface RobotsRules {
  allow: string[];
  disallow: string[];
}

const robotsCache = new Map<string, { expires: number; rules: RobotsRules }>();

function parseRobots(content: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  let applies = false;
  let sawSpecific = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      const agent = value.toLowerCase();
      applies = agent === '*' || agent.includes('travaillerenci');
      if (agent.includes('travaillerenci')) sawSpecific = true;
    } else if (applies && key === 'disallow' && value) {
      rules.disallow.push(value);
    } else if (applies && key === 'allow' && value) {
      rules.allow.push(value);
    }
  }

  // Si un groupe spécifique existe, il est prioritaire : on ne garde que lui.
  if (sawSpecific) {
    const specific = parseSpecificGroup(content);
    if (specific.allow.length || specific.disallow.length) return specific;
  }
  return rules;
}

function parseSpecificGroup(content: string): RobotsRules {
  const rules: RobotsRules = { allow: [], disallow: [] };
  let applies = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim().toLowerCase();
    const value = rest.join(':').trim();
    if (key === 'user-agent') {
      applies = value.toLowerCase().includes('travaillerenci');
    } else if (applies && key === 'disallow' && value) {
      rules.disallow.push(value);
    } else if (applies && key === 'allow' && value) {
      rules.allow.push(value);
    }
  }
  return rules;
}

function pathAllowed(pathname: string, rules: RobotsRules): boolean {
  let bestLength = -1;
  let allowed = true;
  for (const rule of rules.allow) {
    if (pathname.startsWith(rule) && rule.length > bestLength) {
      bestLength = rule.length;
      allowed = true;
    }
  }
  for (const rule of rules.disallow) {
    if (rule === '/') {
      if (bestLength < 1) {
        bestLength = 1;
        allowed = false;
      }
      continue;
    }
    if (pathname.startsWith(rule) && rule.length > bestLength) {
      bestLength = rule.length;
      allowed = false;
    }
  }
  return allowed;
}

/** Vérifie robots.txt une fois par domaine (cache mémoire 24 h). */
export async function isAllowedByRobots(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    if (!/^https?:$/.test(parsed.protocol)) return false;
    const origin = parsed.origin;
    const cached = robotsCache.get(origin);
    if (cached && cached.expires > Date.now()) {
      return pathAllowed(parsed.pathname, cached.rules);
    }

    const response = await fetch(`${origin}/robots.txt`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/plain' },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });

    const rules: RobotsRules = response.ok
      ? parseRobots(await response.text())
      : { allow: [], disallow: [] };

    robotsCache.set(origin, { expires: Date.now() + 24 * 3600 * 1000, rules });
    return pathAllowed(parsed.pathname, rules);
  } catch {
    return true;
  }
}

/** Lit un corps HTTP en limitant la mémoire (flux RSS volumineux). */
export async function readTextCapped(
  response: Response,
  maxBytes: number,
): Promise<string> {
  if (!response.body) return response.text();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        chunks.push(value.slice(0, Math.max(0, maxBytes - (total - value.byteLength))));
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(merged);
}

export async function fetchFeed(
  url: string,
  options: { etag?: string | null; lastModified?: string | null } = {},
): Promise<{ status: number; xml: string; etag: string | null; lastModified: string | null }> {
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
  };
  if (options.etag) headers['If-None-Match'] = options.etag;
  if (options.lastModified) headers['If-Modified-Since'] = options.lastModified;

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(14_000),
    cache: 'no-store',
    redirect: 'follow',
  });

  if (response.status === 304) {
    return { status: 304, xml: '', etag: options.etag ?? null, lastModified: options.lastModified ?? null };
  }
  if (!response.ok) {
    return { status: response.status, xml: '', etag: null, lastModified: null };
  }

  const xml = await readTextCapped(response, 6 * 1024 * 1024);
  return {
    status: response.status,
    xml,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
  };
}

/** Extrait le texte principal d'une page d'article (lecture légère, bornée). */
export async function fetchArticleText(url: string): Promise<string | null> {
  if (!(await isAllowedByRobots(url))) return null;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(9000),
      cache: 'no-store',
      redirect: 'follow',
    });
    if (!response.ok) return null;
    const html = await readTextCapped(response, 2 * 1024 * 1024);
    return extractMainText(html);
  } catch {
    return null;
  }
}

export function extractMainText(html: string): string | null {
  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

  const article = body.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const main = body.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (article) body = article[1];
  else if (main) body = main[1];
  else body = body.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');

  const text = decodeXml(
    body
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6]|blockquote)>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();

  if (text.length < 300) return null;
  return text.slice(0, 7000);
}

export { USER_AGENT };

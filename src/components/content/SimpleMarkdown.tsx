import React from 'react';

/**
 * Rendu Markdown léger pour les contenus (emplois, bourses, concours, blog).
 *
 * Gère : titres (#, ##, ### et lignes entièrement en gras), puces, paragraphes,
 * gras, italique, liens, et IMAGES (syntaxe markdown `![alt](url)` ou HTML
 * `<img src="…">`). Les contenus réécrits par l'IA (Gemini) sont donc restitués
 * proprement : titres en gras, espaces entre paragraphes, images affichées.
 */

const IMAGE_URL = /^https?:\/\//i;

interface InlineImage {
  src: string;
  alt: string;
}

/** Extrait src + alt d'une balise <img …> (déjà isolée sur sa propre ligne). */
function parseHtmlImg(raw: string): InlineImage | null {
  const m = raw.match(/<img[^>]*>/i);
  if (!m) return null;
  const src = m[0].match(/src\s*=\s*["']([^"']+)["']/i)?.[1] ?? '';
  const alt = m[0].match(/alt\s*=\s*["']([^"']*)["']/i)?.[1] ?? '';
  if (!src || !IMAGE_URL.test(src)) return null;
  return { src, alt };
}

export default function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let key = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul
        key={`ul-${key++}`}
        className="my-3 pl-5 space-y-1.5 list-disc marker:text-primary marker:opacity-70"
      >
        {listBuffer.map((it, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inline(it) }} />
        ))}
      </ul>,
    );
    listBuffer = [];
  };

  const pushImage = (img: InlineImage) => {
    flushList();
    blocks.push(
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`img-${key++}`}
        src={img.src}
        alt={img.alt || "Illustration de l'article"}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="my-4 w-full rounded-xl border border-border object-cover"
      />,
    );
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    // Image markdown `![alt](url)` sur sa propre ligne
    const mdImg = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)$/);
    if (mdImg) {
      pushImage({ alt: mdImg[1], src: mdImg[2] });
      continue;
    }

    // Image HTML `<img …>` sur sa propre ligne
    if (/^<img\b/i.test(trimmed)) {
      const parsed = parseHtmlImg(trimmed);
      if (parsed) {
        pushImage(parsed);
        continue;
      }
    }

    // Titres markdown # / ## / ###
    const m = trimmed.match(/^#{1,3}\s+(.*)$/);
    if (m) {
      flushList();
      const level = (trimmed.match(/^#+/)![0].length) as 1 | 2 | 3;
      const sizes = {
        1: 'text-xl sm:text-2xl font-extrabold mt-8 mb-3',
        2: 'text-lg sm:text-xl font-extrabold mt-7 mb-2.5',
        3: 'text-base sm:text-lg font-bold mt-6 mb-2',
      } as const;
      const Tag = (`h${level + 1}` as unknown) as 'h3';
      blocks.push(
        <Tag
          key={`h-${key++}`}
          className={`${sizes[level]} text-black dark:text-white font-[var(--font-display)]`}
          dangerouslySetInnerHTML={{ __html: inline(m[1]) }}
        />,
      );
      continue;
    }

    // Ligne entièrement en gras → titre (Gemini a tendance à mettre les titres en **)
    if (/^\*\*[^*]+\*\*$/.test(trimmed)) {
      flushList();
      blocks.push(
        <h3
          key={`h-${key++}`}
          className="mt-6 mb-2 text-base font-bold text-black dark:text-white font-[var(--font-display)] sm:text-lg"
          dangerouslySetInnerHTML={{ __html: inline(trimmed.slice(2, -2)) }}
        />,
      );
      continue;
    }

    // Puces
    if (/^\s*[-*•]\s+/.test(trimmed)) {
      listBuffer.push(trimmed.replace(/^\s*[-*•]\s+/, ''));
      continue;
    }

    flushList();
    blocks.push(
      <p
        key={`p-${key++}`}
        className="my-3 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: inline(trimmed) }}
      />,
    );
  }
  flushList();
  return <>{blocks}</>;
}

/**
 * Échappement HTML strict : les captures suivantes sont injectées dans des
 * attributs "…" de balises générées — les guillemets DOIVENT être échappés
 * (sinon injection d'attribut / XSS via dangerouslySetInnerHTML).
 */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formatage inline. Ordre volontaire :
 *   1. échappement HTML (dont guillemets) ;
 *   2. gras/italique AVANT l'injection des balises <a>/<img> — sinon les regex
 *      d'emphase pourraient corrompre les URLs injectées contenant des * ;
 *   3. liens et images (les URLS sont déjà échappées : &amp; et &quot; sont
 *      décodés par le navigateur dans les attributs).
 */
function inline(src: string): string {
  let s = escapeHtml(src);

  // Gras
  s = s.replace(
    /\*\*([^*]+)\*\*/g,
    '<strong class="text-black dark:text-white">$1</strong>',
  );

  // Italique
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  // Image inline ![alt](url) AVANT les liens : la forme `![alt](url)` contient
  // `[alt](url)`, la regex lien la consommerait sinon (l'image deviendrait un lien).
  s = s.replace(
    /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
    '<img src="$2" alt="$1" loading="lazy" referrerpolicy="no-referrer" class="inline-block my-2 max-h-64 rounded-lg object-cover" />',
  );

  // Liens [texte](url)
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary underline underline-offset-2 hover:opacity-80">$1</a>',
  );

  return s;
}

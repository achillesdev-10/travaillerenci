/**
 *  TravaillerEnCi — src/services/social/image.ts
 *  Génération PROGRAMMATIQUE des images sociales (aucune IA d'image).
 *
 *  Le template SVG utilise la charte visuelle existante du site (vert
 *  #009639 / accent #003087, fond sombre slate, orange du logo) et reste
 *  facile à modifier : une entrée par catégorie dans IMAGE_TEMPLATES.
 *
 *  Le SVG est converti en PNG (1200×630, recommandé Facebook/LinkedIn) via
 *  `sharp` au moment de la publication — aucun stockage externe requis.
 */

import type { SocialContentFacts } from './facts';

export const SOCIAL_IMAGE_WIDTH = 1200;
export const SOCIAL_IMAGE_HEIGHT = 630;

// -----------------------------------------------------------------------------
//  Templates par catégorie (charte TravaillerEnCi)
// -----------------------------------------------------------------------------

export interface SocialImageTemplate {
  category: string;
  /** Libellé du badge (ex: OFFRE D'EMPLOI). */
  label: string;
  /** Couleur d'accent principale (hex). */
  accent: string;
  /** Couleur d'accent sombre (dégradé). */
  accentDark: string;
}

export const IMAGE_TEMPLATES: SocialImageTemplate[] = [
  { category: 'job', label: "OFFRE D'EMPLOI", accent: '#009639', accentDark: '#007a2e' },
  { category: 'internship', label: 'STAGE', accent: '#0d9488', accentDark: '#0f766e' },
  { category: 'scholarship', label: "BOURSE D'ÉTUDES", accent: '#d97706', accentDark: '#b45309' },
  { category: 'exam', label: 'CONCOURS', accent: '#4f46e5', accentDark: '#4338ca' },
];

export function getImageTemplate(category: string): SocialImageTemplate {
  return IMAGE_TEMPLATES.find((t) => t.category === category) || IMAGE_TEMPLATES[0];
}

// -----------------------------------------------------------------------------
//  Helpers SVG
// -----------------------------------------------------------------------------

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Découpe un texte en lignes de `maxChars` caractères maximum. */
export function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
    } else {
      current = (current + ' ' + word).trim();
    }
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);
  const result = lines.slice(0, maxLines);
  // Truncation finale si le texte déborde.
  const joined = result.join(' ');
  if (joined.length > maxChars * maxLines) {
    result[maxLines - 1] = result[maxLines - 1]!.slice(0, maxChars - 1).trimEnd() + '…';
  }
  return result;
}

/** Icônes SVG simples (sans emoji — compatibilité polices serveur). */
function icon(name: string, x: number, y: number, color: string): string {
  const s = 30;
  switch (name) {
    case 'pin':
      return `
        <g transform="translate(${x},${y})" fill="none" stroke="${color}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M${s / 2} 2c-8.3 0-15 6.7-15 15 0 11 15 28 15 28s15-17 15-28c0-8.3-6.7-15-15-15Z"/>
          <circle cx="${s / 2}" cy="${s / 2 + 3}" r="5.5"/>
        </g>`;
    case 'briefcase':
      return `
        <g transform="translate(${x},${y})" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="${s / 2 - 1}" width="${s - 4}" height="${s / 2 + 4}" rx="4"/>
          <path d="M9 ${s / 2 - 1} v-3 a6 6 0 0 1 12 0 v3"/>
          <path d="M2 ${s / 2 + 9} h28"/>
        </g>`;
    case 'grad':
      return `
        <g transform="translate(${x},${y})" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 14 15 7l12 7-12 7-12-7Z"/>
          <path d="M8 17.5V24c0 3 4 5 7 5s7-2 7-5v-6.5"/>
        </g>`;
    case 'calendar':
      return `
        <g transform="translate(${x},${y})" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="${s - 6}" height="${s - 8}" rx="4"/>
          <path d="M9 2v6M21 2v6M3 12h24"/>
        </g>`;
    default:
      return '';
  }
}

// -----------------------------------------------------------------------------
//  Génération du SVG
// -----------------------------------------------------------------------------

export function buildSocialSvg(facts: SocialContentFacts): string {
  const template = getImageTemplate(facts.type);
  const titleLines = wrapText(facts.title, 44, 2);

  // Faits affichables (uniquement les données réelles).
  const factsRows: Array<{ icon: string; label: string }> = [];
  if (facts.location) factsRows.push({ icon: 'pin', label: facts.location });
  if (facts.contractType) factsRows.push({ icon: 'briefcase', label: facts.contractType });
  if (facts.diplomaLevels.length > 0) {
    factsRows.push({ icon: 'grad', label: facts.diplomaLevels.join(' / ') });
  }
  if (facts.deadlineLabel) factsRows.push({ icon: 'calendar', label: `Clôture : ${facts.deadlineLabel}` });

  const ctaLabel =
    facts.type === 'internship'
      ? 'VOIR LE STAGE'
      : facts.type === 'scholarship'
        ? 'VOIR LA BOURSE'
        : facts.type === 'exam'
          ? 'VOIR LE CONCOURS'
          : "VOIR L'OFFRE";

  // Positionnement des lignes de faits.
  let factsSvg = '';
  factsRows.slice(0, 3).forEach((row, i) => {
    const y = 330 + i * 64;
    factsSvg += icon(row.icon, 76, y, '#e2e8f0');
    const label = row.label.length > 52 ? row.label.slice(0, 51) + '…' : row.label;
    factsSvg += `
      <text x="122" y="${y + 21}" font-family="'DejaVu Sans','Segoe UI',Arial,sans-serif" font-size="26" font-weight="400" fill="#e2e8f0">${escapeXml(label)}</text>`;
  });

  const titleSvg = titleLines
    .map((line, i) => {
      const y = 212 + i * 62;
      return `
      <text x="80" y="${y}" font-family="'DejaVu Sans','Segoe UI',Arial,sans-serif" font-size="50" font-weight="700" fill="#ffffff">${escapeXml(line)}</text>`;
    })
    .join('');

  const companyLine = facts.company
    ? `
      <text x="80" y="185" font-family="'DejaVu Sans','Segoe UI',Arial,sans-serif" font-size="26" font-weight="600" fill="${template.accent}">${escapeXml(facts.company.toUpperCase())}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" viewBox="0 0 ${SOCIAL_IMAGE_WIDTH} ${SOCIAL_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#020617"/>
      <stop offset="100%" stop-color="#0b1120"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${template.accent}"/>
      <stop offset="100%" stop-color="${template.accentDark}"/>
    </linearGradient>
  </defs>
  <rect width="${SOCIAL_IMAGE_WIDTH}" height="${SOCIAL_IMAGE_HEIGHT}" fill="url(#bg)"/>
  <rect x="0" y="0" width="14" height="${SOCIAL_IMAGE_HEIGHT}" fill="url(#accent)"/>
  <circle cx="1080" cy="90" r="200" fill="${template.accent}" opacity="0.07"/>
  <circle cx="1150" cy="560" r="260" fill="${template.accent}" opacity="0.05"/>

  <!-- Wordmark -->
  <text x="80" y="78" font-family="'DejaVu Sans','Segoe UI',Arial,sans-serif" font-size="34" font-weight="800" fill="#ffffff">TRAVAILLER<span fill="#fb923c">EN</span><span fill="#34d399">CI</span></text>
  <circle cx="452" cy="64" r="6" fill="#34d399"/>

  <!-- Badge catégorie -->
  <rect x="80" y="108" width="320" height="48" rx="24" fill="url(#accent)"/>
  <text x="104" y="141" font-family="'DejaVu Sans','Segoe UI',Arial,sans-serif" font-size="24" font-weight="700" fill="#ffffff" letter-spacing="1">${escapeXml(template.label)}</text>

  ${companyLine}
  ${titleSvg}

  ${factsSvg}

  <!-- CTA -->
  <rect x="80" y="540" width="300" height="56" rx="28" fill="url(#accent)"/>
  <text x="230" y="577" text-anchor="middle" font-family="'DejaVu Sans','Segoe UI',Arial,sans-serif" font-size="24" font-weight="700" fill="#ffffff" letter-spacing="1">${escapeXml(ctaLabel)}</text>
  <text x="1080" y="577" text-anchor="end" font-family="'DejaVu Sans','Segoe UI',Arial,sans-serif" font-size="22" font-weight="400" fill="#64748b">travaillerenci.vercel.app</text>
</svg>`;
}

/** Data URI SVG (aperçu navigateur). */
export function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * Conversion SVG → PNG (buffer binaire prêt pour l'upload Facebook/LinkedIn).
 * `sharp` est importé dynamiquement (dépendance native, uniquement nécessaire
 * au moment de la publication).
 */
export async function svgToPng(svg: string): Promise<Buffer> {
  const sharpModule = await import('sharp');
  const sharp = sharpModule.default ?? sharpModule;
  return sharp(Buffer.from(svg))
    .resize(SOCIAL_IMAGE_WIDTH, SOCIAL_IMAGE_HEIGHT)
    .png()
    .toBuffer();
}

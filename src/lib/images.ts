/**
 *  TravaillerEnCi — src/lib/images.ts
 *
 *  Photos d'illustration du site (Unsplash, CDN stable) centralisées ici pour
 *  éviter les URLs dispersées dans les composants. Chaque usage dispose d'une
 *  photo dédiée ; si une URL venait à casser, le fallback graphique (dégradé
 *  de couleur aux couleurs de la marque) s'affiche proprement.
 *
 *  NB : next.config.mjs autorise déjà tous les domaines distants
 *  (remotePatterns hostname: '**'), ces URLs fonctionnent donc en production
 *  comme en local, avec l'optimiseur d'images Next.js (WebP/AVIF).
 */

const UNSPLASH = (id: string, w = 1200) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=70`;

export const IMAGES = {
  // Héro — photo choisie par l'équipe ; le dégradé de la section hero
  // s'affiche dessus.
  hero: 'https://i.postimg.cc/44VsVKqw/2150690154.jpg',
  // Offres d'emploi / bureau
  jobs: UNSPLASH('photo-1521737711867-e3b97375f902', 1000),
  jobsAlt: UNSPLASH('photo-1497366216548-37526070297c', 1000),
  // Stages / étudiants
  internship: UNSPLASH('photo-1523240795612-9a054b0db644', 1000),
  // Bourses / études / diplôme
  scholarship: UNSPLASH('photo-1541339907198-e08756dedf3f', 1000),
  // Concours administratifs
  concours: UNSPLASH('photo-1524178232363-1fb2b075b655', 1000),
  // CV / candidature
  cv: UNSPLASH('photo-1586281380349-632531db7ed4', 1000),
  // Blog / conseils
  blog: UNSPLASH('photo-1499750310107-5fef28a66643', 1000),
  blogAlt: UNSPLASH('photo-1454165804606-c3d57bc86b40', 1000),
  // Secteurs
  it: UNSPLASH('photo-1518770660439-4636190af475', 800),
  banque: UNSPLASH('photo-1560472354-b33ff0c44a43', 800),
  btp: UNSPLASH('photo-1541888946425-d81bb19240f5', 800),
  industrie: UNSPLASH('photo-1565043666747-69f6646db940', 800),
  sante: UNSPLASH('photo-1576091160399-112ba8d25d1d', 800),
  education: UNSPLASH('photo-1524178232363-1fb2b075b655', 800),
  commerce: UNSPLASH('photo-1556740738-b6a63e27c4df', 800),
  transport: UNSPLASH('photo-1601584115197-04ecc0da31d7', 800),
  // Communauté / réseaux
  community: UNSPLASH('photo-1529156069898-49953e39b3ac', 1200),
  // Catégories de concours (administratif, sécurité, militaire, autre…)
  // NB : santé et enseignement réutilisent IMAGES.sante / IMAGES.education.
  examAdmin: UNSPLASH('photo-1497366811353-6870744d04b2', 1000),
  examSecurite: UNSPLASH('photo-1557804506-669a67965ba0', 1000),
  examMilitaire: UNSPLASH('photo-1521791136064-7986c2920216', 1000),
  examAutre: UNSPLASH('photo-1456513080510-7bf3a84b82f8', 1000),
} as const;

// -----------------------------------------------------------------------------
// Nouvelles images locales (dossier public/images) — intégrées avec next/image.
// -----------------------------------------------------------------------------
export const LOCAL_IMAGES = {
  heroBanner: '/images/hero-banner.jpg',
  cvGenerator: '/images/cv-generator-banner.jpg',
  recruiterSection: '/images/recruiter-section.jpg',
  ogImage: '/images/og-image.jpg',
  categoryTech: '/images/category-tech.jpg',
  categoryCommercial: '/images/category-commercial.jpg',
  categoryLogistics: '/images/category-logistics.jpg',
  categoryEngineering: '/images/category-engineering.jpg',
} as const;

// -----------------------------------------------------------------------------
// Dégradés de repli aux couleurs de la marque, utilisés en arrière-plan des
// blocs photo quand l'image ne s'est pas encore chargée (ou a échoué).
// -----------------------------------------------------------------------------
export const IMAGE_FALLBACKS: Record<string, string> = {
  hero: 'from-emerald-700 via-emerald-600 to-teal-600',
  jobs: 'from-orange-500 via-orange-600 to-amber-600',
  scholarship: 'from-emerald-600 via-emerald-700 to-teal-700',
  concours: 'from-indigo-600 via-indigo-700 to-blue-700',
  cv: 'from-purple-600 via-purple-700 to-fuchsia-700',
  blog: 'from-rose-500 via-rose-600 to-pink-600',
  community: 'from-slate-700 via-slate-800 to-slate-900',
} as const;

// -----------------------------------------------------------------------------
// Illustrations SVG inline pour les concours
// -----------------------------------------------------------------------------

/** Encode une chaîne SVG brute en data URI utilisable dans <img src>. */
const svgDataUri = (svg: string) =>
  'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

/** Illustration SVG : Bâtiment administratif (colonnes + drapeau). */
const svgAdmin = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg-admin" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1e3a5f"/>
        <stop offset="100%" stop-color="#0f2942"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg-admin)"/>
    <circle cx="950" cy="120" r="180" fill="#ffffff" opacity="0.04"/>
    <circle cx="200" cy="520" r="140" fill="#ffffff" opacity="0.04"/>
    <!-- Bâtiment -->
    <rect x="380" y="220" width="440" height="280" rx="8" fill="#ffffff" opacity="0.12"/>
    <rect x="360" y="200" width="480" height="40" rx="6" fill="#ffffff" opacity="0.18"/>
    <!-- Colonnes -->
    <rect x="420" y="260" width="28" height="220" rx="4" fill="#ffffff" opacity="0.22"/>
    <rect x="520" y="260" width="28" height="220" rx="4" fill="#ffffff" opacity="0.22"/>
    <rect x="620" y="260" width="28" height="220" rx="4" fill="#ffffff" opacity="0.22"/>
    <rect x="720" y="260" width="28" height="220" rx="4" fill="#ffffff" opacity="0.22"/>
    <!-- Porte -->
    <rect x="540" y="380" width="120" height="120" rx="60" fill="#ffffff" opacity="0.15"/>
    <!-- Triangle du fronton -->
    <polygon points="360,200 600,120 840,200" fill="#ffffff" opacity="0.15"/>
    <!-- Drapeau -->
    <rect x="588" y="60" width="6" height="70" fill="#ffffff" opacity="0.3"/>
    <rect x="594" y="60" width="40" height="28" rx="2" fill="#f77f00" opacity="0.6"/>
    <rect x="594" y="88" width="40" height="28" rx="2" fill="#ffffff" opacity="0.3"/>
    <rect x="594" y="116" width="40" height="28" rx="2" fill="#009639" opacity="0.5"/>
    <!-- Texte -->
    <text x="600" y="570" font-family="Poppins, Arial, sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.7">Administration Publique</text>
  </svg>`,
);

/** Illustration SVG : Santé (croix médicale + cœur). */
const svgSante = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg-sante" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#065f46"/>
        <stop offset="100%" stop-color="#064e3b"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg-sante)"/>
    <circle cx="1000" cy="100" r="200" fill="#ffffff" opacity="0.04"/>
    <circle cx="150" cy="550" r="160" fill="#ffffff" opacity="0.04"/>
    <!-- Croix médicale -->
    <rect x="540" y="140" width="120" height="350" rx="20" fill="#ffffff" opacity="0.2"/>
    <rect x="425" y="255" width="350" height="120" rx="20" fill="#ffffff" opacity="0.2"/>
    <!-- Cœur stylisé -->
    <path d="M600 430 C600 430, 530 390, 530 340 C530 310, 560 290, 590 310 L600 320 L610 310 C640 290, 670 310, 670 340 C670 390, 600 430, 600 430Z" fill="#ef4444" opacity="0.4"/>
    <!-- Éléments décoratifs -->
    <circle cx="300" cy="300" r="15" fill="#34d399" opacity="0.3"/>
    <circle cx="900" cy="350" r="20" fill="#34d399" opacity="0.25"/>
    <circle cx="780" cy="180" r="10" fill="#fbbf24" opacity="0.3"/>
    <!-- Texte -->
    <text x="600" y="570" font-family="Poppins, Arial, sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.7">Santé Publique</text>
  </svg>`,
);

/** Illustration SVG : Enseignement (livre + chapeau de diplômé). */
const svgEnseignement = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg-ens" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0e7490"/>
        <stop offset="100%" stop-color="#155e75"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg-ens)"/>
    <circle cx="1050" cy="80" r="180" fill="#ffffff" opacity="0.04"/>
    <circle cx="100" cy="530" r="140" fill="#ffffff" opacity="0.04"/>
    <!-- Livre ouvert -->
    <path d="M380 280 Q600 240 600 310 L600 430 Q600 370 380 400 Z" fill="#ffffff" opacity="0.18"/>
    <path d="M820 280 Q600 240 600 310 L600 430 Q600 370 820 400 Z" fill="#ffffff" opacity="0.14"/>
    <!-- Lignes du livre -->
    <line x1="420" y1="310" x2="580" y2="285" stroke="#ffffff" stroke-width="1.5" opacity="0.2"/>
    <line x1="420" y1="340" x2="580" y2="315" stroke="#ffffff" stroke-width="1.5" opacity="0.2"/>
    <line x1="420" y1="370" x2="580" y2="345" stroke="#ffffff" stroke-width="1.5" opacity="0.2"/>
    <line x1="620" y1="285" x2="780" y2="310" stroke="#ffffff" stroke-width="1.5" opacity="0.2"/>
    <line x1="620" y1="315" x2="780" y2="340" stroke="#ffffff" stroke-width="1.5" opacity="0.2"/>
    <!-- Chapeau de diplômé au-dessus -->
    <ellipse cx="600" cy="200" rx="90" ry="25" fill="#ffffff" opacity="0.18"/>
    <polygon points="510,200 600,160 690,200" fill="#f77f00" opacity="0.45"/>
    <path d="M510,200 L510,230 L600,250 L690,230 L690,200" fill="none" stroke="#f77f00" stroke-width="2.5" opacity="0.4"/>
    <line x1="600" y1="160" x2="600" y2="175" stroke="#fbbf24" stroke-width="2" opacity="0.5"/>
    <circle cx="600" cy="180" r="6" fill="#fbbf24" opacity="0.5"/>
    <!-- Décorations -->
    <circle cx="300" cy="480" r="12" fill="#34d399" opacity="0.25"/>
    <circle cx="900" cy="200" r="16" fill="#34d399" opacity="0.2"/>
    <!-- Texte -->
    <text x="600" y="570" font-family="Poppins, Arial, sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.7">Enseignement</text>
  </svg>`,
);

/** Illustration SVG : Sécurité (bouclier + check). */
const svgSecurite = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg-sec" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#7c2d12"/>
        <stop offset="100%" stop-color="#9a3412"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg-sec)"/>
    <circle cx="980" cy="100" r="180" fill="#ffffff" opacity="0.04"/>
    <circle cx="180" cy="500" r="150" fill="#ffffff" opacity="0.04"/>
    <!-- Bouclier -->
    <path d="M600 120 L780 190 L780 340 Q780 440 600 500 Q420 440 420 340 L420 190 Z" fill="#ffffff" opacity="0.15" stroke="#ffffff" stroke-width="3" stroke-opacity="0.2"/>
    <!-- Vérification -->
    <path d="M520 310 L575 365 L690 250" fill="none" stroke="#34d399" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity="0.6"/>
    <!-- Éléments décoratifs -->
    <circle cx="300" cy="250" r="12" fill="#fbbf24" opacity="0.25"/>
    <circle cx="920" cy="380" r="18" fill="#fbbf24" opacity="0.2"/>
    <circle cx="850" cy="150" r="8" fill="#ffffff" opacity="0.15"/>
    <!-- Texte -->
    <text x="600" y="570" font-family="Poppins, Arial, sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.7">Sécurité</text>
  </svg>`,
);

/** Illustration SVG : Militaire (étoile + grade). */
const svgMilitaire = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg-mil" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#3f3f46"/>
        <stop offset="100%" stop-color="#27272a"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg-mil)"/>
    <circle cx="1000" cy="90" r="200" fill="#ffffff" opacity="0.03"/>
    <circle cx="200" cy="540" r="160" fill="#ffffff" opacity="0.03"/>
    <!-- Étoile militaire -->
    <polygon points="600,120 640,240 760,240 660,310 700,430 600,360 500,430 540,310 440,240 560,240" fill="#fbbf24" opacity="0.35"/>
    <!-- Cercle intérieur -->
    <circle cx="600" cy="280" r="50" fill="none" stroke="#ffffff" stroke-width="3" opacity="0.2"/>
    <circle cx="600" cy="280" r="30" fill="#ffffff" opacity="0.12"/>
    <!-- Grade / barres -->
    <rect x="480" y="440" width="240" height="8" rx="4" fill="#fbbf24" opacity="0.25"/>
    <rect x="500" y="458" width="200" height="8" rx="4" fill="#fbbf24" opacity="0.2"/>
    <rect x="520" y="476" width="160" height="8" rx="4" fill="#fbbf24" opacity="0.15"/>
    <!-- Décorations -->
    <circle cx="320" cy="220" r="10" fill="#fbbf24" opacity="0.2"/>
    <circle cx="880" cy="350" r="14" fill="#fbbf24" opacity="0.15"/>
    <!-- Texte -->
    <text x="600" y="570" font-family="Poppins, Arial, sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.7">Défense &amp; Armée</text>
  </svg>`,
);

/** Illustration SVG : Autre concours (document + crayon). */
const svgAutre = svgDataUri(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">
    <defs>
      <linearGradient id="bg-autre" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#581c87"/>
        <stop offset="100%" stop-color="#3b0764"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg-autre)"/>
    <circle cx="1020" cy="80" r="180" fill="#ffffff" opacity="0.04"/>
    <circle cx="160" cy="520" r="140" fill="#ffffff" opacity="0.04"/>
    <!-- Document -->
    <rect x="430" y="120" width="280" height="370" rx="12" fill="#ffffff" opacity="0.15"/>
    <rect x="430" y="120" width="280" height="50" rx="12" fill="#ffffff" opacity="0.1"/>
    <!-- Lignes de texte -->
    <rect x="465" y="200" width="180" height="10" rx="5" fill="#ffffff" opacity="0.2"/>
    <rect x="465" y="225" width="220" height="10" rx="5" fill="#ffffff" opacity="0.15"/>
    <rect x="465" y="250" width="160" height="10" rx="5" fill="#ffffff" opacity="0.2"/>
    <rect x="465" y="275" width="200" height="10" rx="5" fill="#ffffff" opacity="0.15"/>
    <rect x="465" y="300" width="190" height="10" rx="5" fill="#ffffff" opacity="0.2"/>
    <rect x="465" y="325" width="170" height="10" rx="5" fill="#ffffff" opacity="0.15"/>
    <!-- Tampon vert -->
    <circle cx="650" cy="430" r="30" fill="#34d399" opacity="0.4"/>
    <path d="M635 430 L645 440 L665 420" fill="none" stroke="#ffffff" stroke-width="4" stroke-linecap="round" opacity="0.6"/>
    <!-- Crayon -->
    <g transform="translate(740 180) rotate(25)">
      <rect x="0" y="0" width="16" height="160" rx="3" fill="#fbbf24" opacity="0.5"/>
      <rect x="0" y="0" width="16" height="30" rx="3" fill="#1e293b" opacity="0.5"/>
      <polygon points="4,160 12,160 8,180" fill="#fbbf24" opacity="0.6"/>
    </g>
    <!-- Décorations -->
    <circle cx="300" cy="280" r="10" fill="#f472b6" opacity="0.2"/>
    <circle cx="900" cy="450" r="16" fill="#f472b6" opacity="0.15"/>
    <!-- Texte -->
    <text x="600" y="570" font-family="Poppins, Arial, sans-serif" font-size="32" font-weight="700" fill="#ffffff" text-anchor="middle" opacity="0.7">Concours Divers</text>
  </svg>`,
);

// -----------------------------------------------------------------------------
// Images par défaut par catégorie — utilisées quand une annonce n'a pas
// d'image propre (les offres scrapées n'en ont jamais ; les concours non plus).
// -----------------------------------------------------------------------------

/** Image par défaut d'une offre d'emploi selon sa catégorie. */
export function jobDefaultImage(category?: string | null): string {
  switch (category) {
    case 'internship':
      return IMAGES.internship;
    case 'scholarship':
      return IMAGES.scholarship;
    case 'exam':
      return IMAGES.concours;
    default:
      return IMAGES.jobs;
  }
}

/**
 * Image par défaut d'un concours selon sa catégorie.
 * Retourne une illustration SVG inline (data URI) au lieu de photos distantes.
 */
export function examDefaultImage(category?: string | null): string {
  switch (category) {
    case 'administratif':
      return svgAdmin;
    case 'sante':
      return svgSante;
    case 'enseignement':
      return svgEnseignement;
    case 'securite':
      return svgSecurite;
    case 'militaire':
      return svgMilitaire;
    default:
      return svgAutre;
  }
}

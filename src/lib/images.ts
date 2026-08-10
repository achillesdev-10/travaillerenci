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
  // Héro — jeune professionnel ivoirien / africain
  hero: UNSPLASH('photo-1573496359142-b8d87734a5a2', 1400),
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
  examAdmin: UNSPLASH('photo-1486406146926-c627a92ad1ab', 1000),
  examSecurite: UNSPLASH('photo-1557597774-9d273605dfa9', 1000),
  examMilitaire: UNSPLASH('photo-1529059997568-3d847b1154f0', 1000),
  examAutre: UNSPLASH('photo-1507679799987-c73779587ccf', 1000),
} as const;

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

/** Image par défaut d'un concours selon sa catégorie. */
export function examDefaultImage(category?: string | null): string {
  switch (category) {
    case 'administratif':
      return IMAGES.examAdmin;
    case 'sante':
      return IMAGES.sante;
    case 'enseignement':
      return IMAGES.education;
    case 'securite':
      return IMAGES.examSecurite;
    case 'militaire':
      return IMAGES.examMilitaire;
    default:
      return IMAGES.examAutre;
  }
}

/**
 * Dégradés de repli aux couleurs de la marque, utilisés en arrière-plan des
 * blocs photo quand l'image ne s'est pas encore chargée (ou a échoué).
 */
export const IMAGE_FALLBACKS: Record<string, string> = {
  hero: 'from-emerald-700 via-emerald-600 to-teal-600',
  jobs: 'from-orange-500 via-orange-600 to-amber-600',
  scholarship: 'from-emerald-600 via-emerald-700 to-teal-700',
  concours: 'from-indigo-600 via-indigo-700 to-blue-700',
  cv: 'from-purple-600 via-purple-700 to-fuchsia-700',
  blog: 'from-rose-500 via-rose-600 to-pink-600',
  community: 'from-slate-700 via-slate-800 to-slate-900',
};

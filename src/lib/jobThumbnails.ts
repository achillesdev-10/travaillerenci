/**
 * TravaillerEnCi — Intelligent Job Thumbnail System
 *
 * Centralized thumbnail selection based on job data.
 * Fallback hierarchy:
 *   1. Explicit job image (future-proof)
 *   2. Company-provided image (future-proof)
 *   3. Profession-specific image (keyword matching)
 *   4. Category image (default per category)
 *   5. Generic TravaillerEnCi fallback
 */

import { IMAGES } from '@/lib/images';
import type { JobOfferSchema, ContentCategory } from '@/types';

// ---------------------------------------------------------------------------
//  Category slug → representative image
// ---------------------------------------------------------------------------
const CATEGORY_IMAGES: Record<string, string> = {
  informatique: IMAGES.it,
  administration: IMAGES.examAdmin,
  comptabilite: IMAGES.banque,
  finance: IMAGES.banque,
  banque: IMAGES.banque,
  commerce: IMAGES.commerce,
  marketing: IMAGES.commerce,
  communication: IMAGES.commerce,
  'ressources-humaines': IMAGES.community,
  sante: IMAGES.sante,
  education: IMAGES.education,
  btp: IMAGES.btp,
  industrie: IMAGES.industrie,
  transport: IMAGES.transport,
  logistique: IMAGES.transport,
  hotellerie: IMAGES.commerce,
  restauration: IMAGES.commerce,
  agriculture: IMAGES.industrie,
  securite: IMAGES.examSecurite,
  telecoms: IMAGES.it,
};

// ---------------------------------------------------------------------------
//  French keyword → category mapping
//  Each entry: { keywords: string[], category: string }
//  Keywords are checked case-insensitively against `title + company + description`.
// ---------------------------------------------------------------------------
interface KeywordMapping {
  keywords: string[];
  category: string;
}

const KEYWORD_MAPPINGS: KeywordMapping[] = [
  // IT / Digital
  {
    keywords: [
      'développeur', 'developer', 'frontend', 'backend', 'fullstack', 'full stack',
      'react', 'javascript', 'typescript', 'node', 'python', 'java', 'php',
      'informatique', 'software', 'devops', 'dev ops', 'web', 'mobile',
      'ux', 'ui', 'data', 'sql', 'database', 'système', 'réseau', 'network',
      'cybersécurité', 'cybersecurity', 'ia', 'machine learning', 'ml',
      'cloud', 'aws', 'azure', 'gcp', 'tech', 'digital', 'digitale',
      'architecte', 'ingénieur logiciel', 'programmeur', 'technicien informatique',
      'admin system', 'administrateur base', 'sgi', 'erp', 'crm',
    ],
    category: 'informatique',
  },
  // Administration
  {
    keywords: [
      'administratif', 'administration', 'secrétaire', 'accueil', 'clerc',
      'agent administratif', 'fonctionnaire', 'public', 'mairie', 'préfecture',
      'ministère', 'état civil', 'bureau', 'scolarité',
    ],
    category: 'administration',
  },
  // Comptabilité / Finance
  {
    keywords: [
      'comptable', 'comptabilité', 'accountant', 'audit', 'finance',
      'financier', 'trésorier', 'gestionnaire', 'budget', 'contrôle',
      'commissaire', 'expert comptable', 'paye', 'paie', 'fiscal',
      'impôt', 'sage', 'quickbooks', 'compta',
    ],
    category: 'comptabilite',
  },
  // Banque
  {
    keywords: [
      'banque', 'banquier', 'bank', 'crédit', 'loan', 'teller',
      'conseiller clientèle', 'chargé clientèle', 'guichetier',
    ],
    category: 'banque',
  },
  // Commerce
  {
    keywords: [
      'commercial', 'vente', 'sales', 'vendeur', 'magasinier',
      'responsable commercial', 'chargé commercial', 'négociateur',
      'distribution', 'merchandising', 'acheteur', 'approvisionnement',
    ],
    category: 'commerce',
  },
  // Marketing / Communication
  {
    keywords: [
      'marketing', 'communication', 'community manager', 'réseaux sociaux',
      'publicité', 'ads', 'seo', 'sem', 'brand', 'marque',
      'chef de projet', 'événementiel', 'communication interne',
    ],
    category: 'marketing',
  },
  // Ressources Humaines
  {
    keywords: [
      'rh', 'ressources humaines', 'human resource', 'recrutement',
      'talent', 'formation', 'paie', 'payroll', 'administration du personnel',
      'chargé recrutement', 'resp. rh', 'responsable rh',
    ],
    category: 'ressources-humaines',
  },
  // Santé
  {
    keywords: [
      'infirmier', 'infirmière', 'médecin', 'pharmacien', 'santé',
      'hospitalier', 'hôpital', 'clinique', 'laboratoire', 'biologiste',
      'dentiste', 'kinésithérapeute', 'sage-femme', 'ambulancier',
      'technicien de santé', 'aide-soignant', 'médecin chef',
    ],
    category: 'sante',
  },
  // Éducation
  {
    keywords: [
      'enseignant', 'professeur', 'educateur', 'éducateur', 'pédagogue',
      'instituteur', 'maître', 'formateur', 'tuteur', 'académique',
      'scolaire', 'université', 'école', 'lycée', 'collège',
      'chargé de cours', 'assistant pédagogique',
    ],
    category: 'education',
  },
  // BTP
  {
    keywords: [
      'btp', 'construction', 'chantier', 'génie civil', 'maçon',
      'charpentier', 'soudeur', 'électricien', 'plombier', 'installateur',
      'architecte', 'urbanisme', 'topographe', 'immobilier',
      'conducteur travaux', 'chef de chantier', 'métreur',
    ],
    category: 'btp',
  },
  // Industrie
  {
    keywords: [
      'industrie', 'industriel', 'production', 'usine', 'fabrication',
      'maintenance', 'mécanicien', 'mécanique', 'qualité', 'quality',
      'process', 'opérateur', 'machine', 'équipement', 'logistique industrielle',
      'supply chain', 'stockage', 'entreposage', 'emballage',
    ],
    category: 'industrie',
  },
  // Transport / Logistique
  {
    keywords: [
      'chauffeur', 'conducteur', 'driver', 'livreur', 'transport',
      'logistique', 'expédition', 'fret', 'marine', ' maritime',
      'cariste', 'magasinier', 'manutentionnaire', 'routier',
      'motard', 'taxis', 'vlm', 'permis', 'livraison',
    ],
    category: 'transport',
  },
  // Hôtellerie / Restauration
  {
    keywords: [
      'serveur', 'serveuse', 'cuisinier', 'chef', 'restaurant',
      'hôtel', 'hotel', 'hôtellerie', 'restauration', 'barman',
      'bartender', 'réceptionniste', 'pâtissier', 'plongeur',
      'hotellerie', 'animation', 'guide touristique',
    ],
    category: 'hotellerie',
  },
  // Agriculture
  {
    keywords: [
      'agriculture', 'agricole', 'agronome', 'élevage', 'pisciculture',
      'horticulture', 'agroalimentaire', 'agro', 'cultures', 'récolte',
      'irrigation', 'plantation',
    ],
    category: 'agriculture',
  },
  // Sécurité
  {
    keywords: [
      'sécurité', 'security', 'vigile', 'gardien', 'agent sécurité',
      'surveillant', 'sûreté', 'protection', 'gardiennage',      "forces de l'ordre",
      'police', 'gendarmerie', 'pompiers',
    ],
    category: 'securite',
  },
  // Télécommunications
  {
    keywords: [
      'télécom', 'télécommunications', 'telecom', 'antenne',
      'opérateur télécom', 'mobile', 'réseau', 'téléphonie',
      'fiber', 'fibre', '4g', '5g',
    ],
    category: 'telecommunications',
  },
];

// ---------------------------------------------------------------------------
//  Accent / diacritics normalization helper
// ---------------------------------------------------------------------------
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
//  Core: match keywords against text
// ---------------------------------------------------------------------------
function matchCategory(text: string): string | null {
  const normalized = stripAccents(text.toLowerCase());

  for (const mapping of KEYWORD_MAPPINGS) {
    for (const keyword of mapping.keywords) {
      const kw = stripAccents(keyword.toLowerCase());
      // Use word-boundary check: ensure we match whole words
      const regex = new RegExp(`\b${kw.replace(/[.*+?^${}()|[\]\-]/g, '\\$&')}\b`);
      if (regex.test(normalized)) {
        return mapping.category;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
//  Public API
// ---------------------------------------------------------------------------

/**
 * Returns the best thumbnail URL for a job offer.
 *
 * Fallback hierarchy:
 *   1. Explicit job image (if `job.image_url` exists in the future)
 *   2. Company-provided image (if `job.company_logo` exists in the future)
 *   3. Profession-specific image (keyword matching on title + company + description)
 *   4. Category-based image
 *   5. Generic fallback
 */
export function getJobThumbnail(job: JobOfferSchema): string {
  // 1. Explicit image (future-proof: some CMS may add an image field)
  const jobObj = job as unknown as Record<string, unknown>;
  if (typeof jobObj.image_url === 'string' && jobObj.image_url) {
    return jobObj.image_url;
  }
  if (typeof jobObj.image === 'string' && jobObj.image) {
    return jobObj.image;
  }

  // 2. Company logo (future-proof)
  if (typeof jobObj.company_logo === 'string' && jobObj.company_logo) {
    return jobObj.company_logo;
  }

  // 3. Profession-specific: match keywords across title + company + description
  const searchableText = [job.title, job.company, job.description].filter(Boolean).join(' ');
  const matchedCategory = matchCategory(searchableText);
  if (matchedCategory && CATEGORY_IMAGES[matchedCategory]) {
    return CATEGORY_IMAGES[matchedCategory];
  }

  // 4. Category-based fallback
  const category = job.category as ContentCategory | undefined;
  switch (category) {
    case 'internship':
      return IMAGES.internship;
    case 'scholarship':
      return IMAGES.scholarship;
    case 'exam':
      return IMAGES.concours;
  }

  // 5. Contract-type heuristic
  if (job.contract_type === 'Stage') {
    return IMAGES.internship;
  }

  // 6. Generic fallback
  return IMAGES.jobs;
}

/**
 * Returns a CSS gradient fallback for when the image is loading or failed.
 */
export function getJobThumbnailGradient(category?: string | null): string {
  switch (category) {
    case 'internship':
      return 'from-sky-400 to-blue-600';
    case 'scholarship':
      return 'from-emerald-400 to-teal-600';
    case 'exam':
      return 'from-indigo-400 to-blue-700';
    default:
      return 'from-orange-400 to-amber-600';
  }
}

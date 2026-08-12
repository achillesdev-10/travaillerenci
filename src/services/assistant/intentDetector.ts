/**
 *  TravaillerEnCi — Assistant : détecteur d'intention déterministe
 *  Chemin : src/services/assistant/intentDetector.ts
 *
 *  Couche 1 du pipeline : comprendre la demande SANS IA, à l'aide de
 *  règles simples (mots-clés, normalisation sans accents, liste des villes
 *  et secteurs du site). Rapide, déterministe, testable.
 *
 *  Priorités :
 *   1. FAQ (réponses prédéfinies) si la demande correspond à une question
 *      fréquente (compte, CV, contact, catégories, aide).
 *   2. Recherche en base si une catégorie / ville / domaine / mot-clé est
 *      détecté.
 *   3. IA (Gemini → Groq) uniquement si rien de tout cela ne matche.
 */

import { REGIONS_CI, SECTORS } from '@/lib/constants';
import type {
  AssistantCategory,
  AssistantIntent,
  AssistantSearchCriteria,
} from './types';

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

/** Minuscules + suppression des accents (comparaisons robustes). */
export function normalizeText(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// ---------------------------------------------------------------------------
// Dictionnaires de mots-clés
// ---------------------------------------------------------------------------

/** Mots déclenchant la catégorie « emploi ». */
const JOB_KEYWORDS = [
  'emploi', 'emplois', 'job', 'jobs', 'travail', 'recrutement',
  'recrute', 'poste', 'postes', 'offre', 'offres', 'carriere', 'cdi', 'cdd',
];

/** Mots déclenchant la catégorie « stage ». */
const INTERNSHIP_KEYWORDS = [
  'stage', 'stages', 'stagiaire', 'stagiaires', 'stage pro', 'apprentissage',
];

/** Mots déclenchant la catégorie « bourse ». */
const SCHOLARSHIP_KEYWORDS = [
  'bourse', 'bourses', 'bourse detude', 'bourses detudes', 'scholarship',
  'scholarships', 'financer mes etudes', 'etudier a letranger', 'etudes superieures',
];

/** Mots déclenchant la catégorie « concours ». */
const EXAM_KEYWORDS = [
  'concours', 'concours administratif', 'concours administratifs',
  'fonction publique', 'concours direct', 'concours de recrutement',
  'recrutement concours', 'ena', 'infas', 'ensa', 'entree a lecole',
  'concours sante', 'concours enseignement', 'concours militaire',
];

/** Clés FAQ — questions fréquentes. */
const FAQ_PATTERNS: Array<{ key: string; patterns: string[] }> = [
  {
    key: 'create_account',
    patterns: [
      'creer un compte', 'creer mon compte', 'inscription', "m'inscrire",
      'comment creer un compte', 'comment s inscrire', "comment m inscrire",
      'je veux un compte', 'creer compte',
    ],
  },
  {
    key: 'create_cv',
    patterns: [
      'creer mon cv', 'creer un cv', 'generateur de cv', 'generer mon cv',
      'generer un cv', 'comment creer un cv', 'cv gratuit', 'faire un cv',
      'telecharger mon cv', 'cv professionnel',
    ],
  },
  {
    key: 'categories',
    patterns: [
      'quelles categories', 'quels types d offres', 'que proposez vous',
      'que propose le site', 'categories disponibles', 'quelles sections',
      'quels contenus', 'quels types de contenu',
    ],
  },
  {
    key: 'contact',
    patterns: [
      'comment vous contacter', 'comment contacter travaillerenci',
      'vous contacter', 'votre email', 'votre contact', 'adresse email',
      'nous contacter', 'contact', 'telephone', 'appeler',
    ],
  },
  {
    key: 'how_to_use',
    patterns: [
      'comment utiliser le site', 'comment ca marche', 'comment cela marche',
      'aide', "aidez moi a utiliser", 'comment naviguer', 'guide utilisation',
    ],
  },
  {
    key: 'apply_how',
    patterns: [
      'comment postuler', 'comment candidater', 'postuler a une offre',
      'candidater', 'envoyer ma candidature', 'comment postuler a un concours',
    ],
  },
];

// ---------------------------------------------------------------------------
// Extraction des critères de recherche
// ---------------------------------------------------------------------------

/** Villes et communes ivoiriennes connues (même liste que le site). */
const LOCATIONS = REGIONS_CI.map((r) => normalizeText(r.name));


/**
 * Détecte la ville dans un texte normalisé.
 * Retourne la forme la plus proche du site (ex : « Abidjan », « Bouaké »).
 */
export function detectLocation(input: string): string | undefined {
  const hits: Array<{ region: (typeof REGIONS_CI)[number]; score: number }> = [];

  for (const region of REGIONS_CI) {
    const name = normalizeText(region.name);
    if (name.length < 3) continue;
    if (input.includes(name)) {
      // Un nom court (« Man ») mérite moins de confiance qu'un nom long.
      hits.push({ region, score: name.length });
    }
  }

  if (hits.length === 0) return undefined;
  hits.sort((a, b) => b.score - a.score);
  return hits[0].region.name;
}

/** Détecte le(s) domaine(s)/secteur(s) cités (ex : informatique, finance). */
export function detectSectors(input: string): string[] {
  const found: string[] = [];
  for (const sector of SECTORS) {
    // Clés candidates : nom complet ET premier segment (« IT » pour « IT / Digital »).
    const names = [normalizeText(sector.name), normalizeText(sector.name.split('/')[0])];
    if (names.some((n) => n.length >= 3 && input.includes(n))) {
      found.push(sector.name);
    }
  }
  return found;
}

/**
 * Détermine les catégories demandées (peut en retourner plusieurs).
 * Si aucune catégorie n'est détectée, retourne [] (recherche toutes).
 */
export function detectCategories(input: string): AssistantCategory[] {
  const categories: AssistantCategory[] = [];
  if (INTERNSHIP_KEYWORDS.some((k) => input.includes(k))) categories.push('internship');
  if (SCHOLARSHIP_KEYWORDS.some((k) => input.includes(k))) categories.push('scholarship');
  if (EXAM_KEYWORDS.some((k) => input.includes(k))) categories.push('exam');
  if (JOB_KEYWORDS.some((k) => input.includes(k))) categories.push('job');
  return categories;
}

/**
 * Coupe les mots-clés « remplissage » (verbes, prépositions, catégories déjà
 * traitées) pour ne garder que les termes de recherche utiles.
 */
const STOPWORDS = new Set([
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles', 'me', 'te',
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'a', 'au', 'aux',
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'pour', 'par', 'sur', 'sous',
  'avec', 'sans', 'dans', 'vers', 'chez', 'entre', 'depuis', 'pendant', 'avant',
  'apres', 'cherche', 'chercher', 'trouver', 'trouve', 'montre', 'montrer',
  'affiche', 'afficher', 'donne', 'donner', 'voir', 'consulter',
  'quels', 'quelles', 'quel', 'quelle', 'qu', 'qui', 'que', 'quoi', 'comment',
  'combien', 's il', 'sil', 'plait', 'svp', 'merci', 'bonjour', 'salut', 'besoin',
  'disponible', 'disponibles', 'actuellement', 'maintenant', 'connaitre',
  'connaissez', 'avez', 'il y a', 'y a', 'ya',
  // Termes vagues ou de modalité : une demande complexe (ex : « je viens
  // d'avoir le BAC, que faire ? ») ne doit pas devenir une recherche banale.
  'venir', 'viens', 'avoir', 'voudrais', 'voulais', 'veux', 'savoir',
  'pourraient', 'pourrais', 'pourrait', 'convenir', 'conviendrait', 'faire',
  'quoi', 'plus', 'moins', 'tres', 'tout', 'tous', 'autre', 'autres', 'chose',
  'choses', 'penser', 'pense', 'conseiller', 'recommander', 'orienter',
  'aider', 'proposer', 'propose', 'idee', 'conseil', 'conseils', 'information',
  'informations', 'sujet', 'question', 'questions', 'existe', 'existe t il',
]);

/**
 * Mots-clés métier forts : un de ces termes suffit à déclencher une recherche
 * même sans catégorie ni ville explicites (domaines, contrats, diplômes).
 */
const STRONG_KEYWORDS = new Set([
  // Domaines / secteurs
  'informatique', 'digital', 'finance', 'banque', 'comptable',
  'comptabilite', 'ingenieur', 'ingenierie', 'developpeur', 'developpement',
  'commercial', 'commerce', 'sante', 'medecine', 'enseignement', 'professeur',
  'btp', 'construction', 'marketing', 'communication', 'data', 'analyst',
  'logistique', 'transport', 'telecom', 'telecoms', 'juridique', 'droit',
  'audit', 'conseil', 'industrie', 'agroalimentaire', 'agriculture',
  'tourisme', 'hotellerie', 'media', 'medias', 'ressources humaines',
  // Contrats
  'cdi', 'cdd', 'freelance', 'alternance', 'temps plein', 'temps partiel',
]);

/**
 * Extrait les mots-clés utiles : tous les mots du message, moins les
 * stopwords, les villes et les termes de catégorie/domaine déjà gérés.
 */
export function extractKeywords(input: string): string[] {
  const categoryWords = new Set(
    [...JOB_KEYWORDS, ...INTERNSHIP_KEYWORDS, ...SCHOLARSHIP_KEYWORDS, ...EXAM_KEYWORDS]
      .flatMap((k) => k.split(' ')),
  );
  const stop = new Set([...STOPWORDS, ...categoryWords, ...LOCATIONS]);

  return input
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3)
    .filter((w) => !stop.has(w));
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

/**
 * Analyse un message utilisateur et retourne l'intention.
 * Ordre : FAQ → recherche → IA.
 */
export function detectIntent(rawMessage: string): AssistantIntent {
  const normalized = normalizeText(rawMessage.trim());

  // 1. FAQ — question fréquente ?
  for (const { key, patterns } of FAQ_PATTERNS) {
    if (patterns.some((p) => normalized.includes(p))) {
      return { kind: 'faq', faqKey: key, normalized };
    }
  }

  // 2. Recherche — signal fort : catégorie, ville, domaine, ou mot-clé métier
  //    précis (un message vague « que faire après le BAC ? » va en IA, pas en
  //    recherche).
  const categories = detectCategories(normalized);
  const location = detectLocation(normalized);
  const sectors = detectSectors(normalized);
  const keywords = extractKeywords(normalized);

  const hasSignal =
    categories.length > 0 ||
    Boolean(location) ||
    sectors.length > 0 ||
    keywords.some((k) => STRONG_KEYWORDS.has(k));

  if (hasSignal) {
    const search: AssistantSearchCriteria = {
      categories,
      location,
      // Les secteurs deviennent des mots-clés (le dépôt unifié n'a pas de
      // colonne secteur : la recherche se fait sur titre/entreprise/description).
      keywords: [...sectors.map((s) => s.split('/')[0].trim()), ...keywords].filter(Boolean),
    };
    return { kind: 'search', search, normalized };
  }

  // 3. Aucune règle ne matche → demande complexe, déléguer à l'IA.
  return { kind: 'ai', normalized };
}

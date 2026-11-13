import type { ArticleCategory } from '@/types/article';

/** Libellés partagés par le public, l'admin et le pipeline. */
export const NEWS_CATEGORY_LABELS: Record<ArticleCategory, string> = {
  emploi: 'Emploi',
  formation: 'Formation',
  concours: 'Concours',
  economie: 'Économie',
  carriere: 'Carrière',
  guide: 'Guide',
  societe: 'Société',
  technologie: 'Technologie',
  afrique: 'Afrique',
  entrepreneuriat: 'Entrepreneuriat',
  opportunites: 'Opportunités',
};

export const NEWS_CATEGORIES: Array<{ value: ArticleCategory; label: string }> = (
  Object.keys(NEWS_CATEGORY_LABELS) as ArticleCategory[]
).map((value) => ({ value, label: NEWS_CATEGORY_LABELS[value] }));

/** Catégories proposées par défaut dans le formulaire admin. */
export const NEWS_FORM_CATEGORIES = NEWS_CATEGORIES;

const CATEGORY_KEYWORDS: Record<ArticleCategory, string[]> = {
  emploi: [
    'emploi', 'recrutement', 'recrute', 'offre d emploi', 'poste', 'salaire',
    'travail', 'chomage', 'cdi', 'cdd', 'stage', 'main d oeuvre', 'carriere',
  ],
  formation: [
    'formation', 'diplome', 'ecole', 'universite', 'etudiant', 'apprentissage',
    'certification', 'bts', 'licence', 'master', 'education', 'examen scolaire',
  ],
  concours: [
    'concours', 'administratif', 'fonction publique', 'admission', 'epreuve',
    'inscription', 'candidature', 'resultat', 'oral', 'ecrit',
  ],
  economie: [
    'economie', 'croissance', 'pib', 'inflation', 'budget', 'banque', 'finance',
    'investissement', 'marche', 'prix', 'fiscalite', 'douane', 'bceao', 'uemoa',
    'entreprise', 'industrie', 'exportation', 'importation', 'cacao', 'cafe',
  ],
  carriere: [
    'carriere', 'conseil', 'competence', 'entretien', 'cv', 'lettre de motivation',
    'leadership', 'manager', 'productivite', 'reconversion',
  ],
  guide: [
    'guide', 'conseil', 'comment', 'etapes', 'astuces', 'mode d emploi',
  ],
  societe: [
    'societe', 'social', 'sante', 'securite', 'justice', 'femme', 'jeunesse',
    'population', 'crise', 'greve', 'manifestation', 'environnement', 'climat',
    'eau', 'electricite', 'transport', 'logement', 'migration',
  ],
  technologie: [
    'technologie', 'numerique', 'digital', 'internet', 'mobile', 'application',
    'startup', 'intelligence artificielle', 'ia', 'donnees', 'cybersecurite',
    'telecom', 'orange', 'mtn', 'moov', 'fintech', 'innovation',
  ],
  afrique: [
    'afrique', 'africain', 'cedeao', 'union africaine', 'ua', 'nigeria', 'ghana',
    'senegal', 'mali', 'burkina', 'cameroun', 'kenya', 'continent',
  ],
  entrepreneuriat: [
    'entrepreneur', 'entrepreneuriat', 'startup', 'pme', 'tpe', 'business',
    'creation d entreprise', 'financement', 'incubateur', 'fonds', 'artisan',
  ],
  opportunites: [
    'opportunite', 'bourse', 'appel a candidature', 'programme', 'incubation',
    'subvention', 'financement', 'concours', 'stage', 'volontariat', 'emploi',
  ],
};

/** Normalise une catégorie renvoyée par l'IA ou un formulaire. */
export function normalizeNewsCategory(raw: unknown): ArticleCategory {
  const value = String(raw ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z]/g, '');
  const aliases: Record<string, ArticleCategory> = {
    emploi: 'emploi',
    job: 'emploi',
    jobs: 'emploi',
    recrutement: 'emploi',
    formation: 'formation',
    education: 'formation',
    concours: 'concours',
    economie: 'economie',
    finance: 'economie',
    carriere: 'carriere',
    guide: 'guide',
    conseils: 'guide',
    societe: 'societe',
    social: 'societe',
    technologie: 'technologie',
    tech: 'technologie',
    numerique: 'technologie',
    afrique: 'afrique',
    africanews: 'afrique',
    entrepreneuriat: 'entrepreneuriat',
    entrepreneur: 'entrepreneuriat',
    opportunites: 'opportunites',
    opportunite: 'opportunites',
  };
  return aliases[value] ?? 'societe';
}

/** Heuristique légère (sans IA) pour classer un titre/résumé RSS. */
export function guessNewsCategory(title: string, summary = ''): ArticleCategory {
  const text = `${title} ${summary}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ');
  let best: ArticleCategory = 'societe';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as Array<
    [ArticleCategory, string[]]
  >) {
    let score = 0;
    for (const keyword of keywords) {
      if (text.includes(keyword)) score += keyword.includes(' ') ? 2 : 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = category;
    }
  }
  return best;
}

/** Vrai si le texte concerne les sujets prioritaires du site. */
export function isRelevantNews(title: string, summary = ''): boolean {
  const text = `${title} ${summary}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const signals = [
    'cote d ivoire', 'ivoir', 'abidjan', 'yamoussoukro', 'bouake',
    'afrique', 'africain', 'cedeao', 'uemoa', 'union africaine',
    'emploi', 'recrut', 'travail', 'salaire', 'chomage', 'formation',
    'education', 'ecole', 'universite', 'concours', 'bourse', 'stage',
    'economie', 'entreprise', 'startup', 'entrepreneur', 'pme', 'investissement',
    'banque', 'finance', 'budget', 'inflation', 'cacao', 'cafe', 'petrole',
    'technologie', 'numerique', 'digital', 'internet', 'telecom', 'innovation',
    'societe', 'sante', 'jeunesse', 'femme', 'securite', 'environnement',
  ];
  return signals.some((signal) => text.includes(signal));
}

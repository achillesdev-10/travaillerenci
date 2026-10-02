/**
 *  TravaillerEnCi — src/lib/recommendationScoring.ts
 *
 *  Moteur de recommandation DÉTERMINISTE (aucune IA, aucun coût).
 *
 *  Objectif : classer les offres publiées selon la proximité avec le profil
 *  candidat (ville, secteurs d'intérêt, diplôme, type de contrat).
 *
 *  ──────────────────────────────────────────────────────────────────────────
 *  BARÈME (documenté, volontairement simple et explicable à l'utilisateur)
 *  ──────────────────────────────────────────────────────────────────────────
 *    • Domaine / secteur d'intérêt correspondant … +40  (le signal le + fort)
 *    • Même ville que le profil …………………………… +25
 *    • Compétence du profil présente dans l'offre … +20  (§10 : compétences)
 *    • Type de contrat recherché …………………………… +15  (champ profil, prêt pour
 *                                                      la future migration)
 *    • Niveau d'expérience compatible ……………………… +10  (§10 : expérience)
 *    • Diplôme mentionné dans l'offre ……………………… +10
 *    • Offre récente (≤ 7 jours) …………………………… +8
 *    • Offre récente (≤ 30 jours) …………………………… +4
 *    • Offre vérifiée ………………………………………………… +3
 *
 *  Les scores sont additifs. À score égal, l'offre la plus récente passe
 *  devant (tri stable).
 *
 *  Le bonus « compétence » est compté UNE fois par offre (les compétences
 *  appariées sont listées dans `reasons`). Le bonus « expérience » n'est
 *  accordé que si l'offre mentionne explicitement un niveau (junior,
 *  confirmé, senior, manager…) compatible avec le profil.
 *
 *  La correspondance « domaine » utilise d'abord la colonne `job_offers.sector`
 *  (correspondance exacte) quand elle est renseignée ; sinon elle retombe sur
 *  une recherche par mots-clés dans le titre et la description.
 *
 *  Amélioration future (architecture prévue) : remplacer/augmenter ce barème
 *  par des poids pondérés (`RECOMMENDATION_WEIGHTS`) sans toucher aux
 *  consommateurs — `rankJobs()` reste la seule porte d'entrée du classement.
 *
 *  IMPORTANT : ce module est PUR (aucun import serveur / Next). Il est
 *  directement couvert par tests/recommendationScoring.test.ts.
 */

/** Champs du profil candidat utiles au scoring. */
export interface RecommendationProfile {
  city?: string | null;
  diploma?: string | null;
  sectors?: string[] | null;
  /** Champs non encore persistés — préparés pour la future évolution. */
  contractTypes?: string[] | null;
  /** Compétences saisies dans le profil (`candidate_profiles.skills`). */
  skills?: string[] | null;
  /** Niveau d'expérience (JOB_LEVELS : Junior, Intermédiaire, Senior…). */
  experienceLevel?: string | null;
}

/** Sous-ensemble de l'offre nécessaire au scoring (évite un couplage fort). */
export interface ScorableJob {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  contract_type?: string | null;
  /** Slug de métier/domaine (colonne job_offers.sector) — prioritaire s'il est renseigné. */
  sector?: string | null;
  is_verified?: boolean | null;
  created_at?: string | null;
}

export interface JobScore {
  score: number;
  /** Raisons lisibles, affichées en badges côté UI (ex : « Domaine Informatique »). */
  reasons: string[];
  /** Slug du secteur d'intérêt correspondant, si trouvé. */
  matchedSector?: string;
}

// ---------------------------------------------------------------------------
//  Pondérations (exportées pour être testables / ajustables au même endroit)
// ---------------------------------------------------------------------------
export const RECOMMENDATION_WEIGHTS = {
  sector: 40,
  city: 25,
  skills: 20,
  contract: 15,
  experience: 10,
  diploma: 10,
  fresh7d: 8,
  fresh30d: 4,
  verified: 3,
} as const;

// ---------------------------------------------------------------------------
//  Dictionnaire secteurs → mots-clés
//  Les libellés miroitent `SECTORS` de src/lib/constants.ts (source unique
//  côté app) ; le duplicata est volontaire pour garder ce module pur/testable.
// ---------------------------------------------------------------------------
export const SECTOR_KEYWORDS: Record<string, { label: string; keywords: string[] }> = {
  'it-digital': {
    label: 'Informatique / Digital',
    keywords: [
      'developpeur', 'developpeuse', 'informatique', 'logiciel', 'web', 'mobile',
      'data', 'devops', 'cybersecurite', 'analyste', 'programmeur', 'reseau',
      'systeme', 'support informatique', 'full stack', 'frontend', 'backend',
      'ingenieur logiciel', 'technicien informatique', 'cloud',
    ],
  },
  'banque-finance': {
    label: 'Banque / Finance',
    keywords: [
      'comptable', 'comptabilite', 'comptable', 'finance', 'banque', 'bancaire',
      'auditeur', 'audit', 'financier', 'tresorerie', 'controleur de gestion',
      'credit', 'caissier', 'analyste financier', 'fiscalite',
    ],
  },
  'btp-immobilier': {
    label: 'BTP / Immobilier',
    keywords: [
      'chantier', 'btp', 'genie civil', 'macon', 'maconnerie', 'electricien',
      'plombier', 'immobilier', 'architecte', 'conducteur de travaux',
      'topographe', 'metre', 'carreleur', 'menuisier',
    ],
  },
  industrie: {
    label: 'Industrie',
    keywords: [
      'industriel', 'production', 'maintenance', 'machine', 'operateur', 'usine',
      'mecanicien', 'electromecanique', 'qualite', 'automatisme', 'soudeur',
      'technicien de maintenance',
    ],
  },
  'commerce-distribution': {
    label: 'Commerce / Distribution',
    keywords: [
      'commercial', 'commerciale', 'vendeur', 'vendeuse', 'vente', 'distribution',
      'magasin', 'acheteur', 'approvisionnement', 'boutique', 'representant',
      'chef de rayon', 'merchandiser',
    ],
  },
  sante: {
    label: 'Santé',
    keywords: [
      'infirmier', 'infirmiere', 'medecin', 'sante', 'pharmacien', 'sage-femme',
      'laboratoire', 'aide-soignant', 'kinesitherapeute', 'dentiste',
      'biologiste', 'ambulancier',
    ],
  },
  'education-formation': {
    label: 'Éducation / Formation',
    keywords: [
      'enseignant', 'enseignante', 'professeur', 'formateur', 'education',
      'instituteur', 'educateur', 'surveillant', 'ecole', 'pedagogie',
      'animation socioculturelle',
    ],
  },
  agroalimentaire: {
    label: 'Agroalimentaire / Agriculture',
    keywords: [
      'agricole', 'agriculture', 'agroalimentaire', 'agronome', 'plantation',
      'elevage', 'agro', 'peche', 'forestier', 'horticulture',
    ],
  },
  telecoms: {
    label: 'Télécoms',
    keywords: [
      'telecom', 'telecommunication', 'fibre', 'mobile', 'telephonie',
      'technicien reseau', 'antenne', 'radio',
    ],
  },
  'transport-logistique': {
    label: 'Transport / Logistique',
    keywords: [
      'chauffeur', 'transport', 'logistique', 'livreur', 'magasinier', 'transit',
      'entrepot', 'conducteur', 'douane', 'supply chain', 'approvisionneur',
    ],
  },
  'tourisme-hotellerie': {
    label: 'Tourisme / Hôtellerie',
    keywords: [
      'hotel', 'hotelier', 'restauration', 'restaurant', 'serveur', 'serveuse',
      'cuisinier', 'tourisme', 'receptionniste', 'guide', 'patissier',
      'gouvernante', 'barman',
    ],
  },
  'audiovisuel-medias': {
    label: 'Audiovisuel / Médias',
    keywords: [
      'journaliste', 'media', 'audiovisuel', 'redacteur', 'redactrice',
      'montage', 'video', 'presentateur', 'photographe', 'realisateur',
      'attaché de presse', 'community manager',
    ],
  },
  'audit-conseil': {
    label: 'Audit / Conseil',
    keywords: [
      'conseil', 'consultant', 'consultante', 'audit', 'conseiller', 'expertise',
      'strategie', 'organisation',
    ],
  },
  juridique: {
    label: 'Juridique',
    keywords: [
      'juridique', 'juriste', 'avocat', 'droit', 'notaire', 'huissier',
      'contentieux', 'legal', 'conformite',
    ],
  },
  rh: {
    label: 'Ressources Humaines',
    keywords: [
      'ressources humaines', 'recrutement', 'recruteur', 'paie', 'gestionnaire rh',
      'chargee de recrutement', 'formation professionnelle',
    ],
  },
  'marketing-communication': {
    label: 'Marketing / Communication',
    keywords: [
      'marketing', 'communication', 'digital', 'reseaux sociaux', 'seo', 'publicite',
      'graphiste', 'brand', 'marketing digital', 'charge de communication',
    ],
  },
};

/** Mots-clés de diplôme (valeurs de EDUCATION_LEVELS → recherche dans l'offre). */
export const DIPLOMA_KEYWORDS: Record<string, string[]> = {
  baccalaureat: ['baccalaureat', 'bac '],
  bts_dut: ['bts', 'dut'],
  licence: ['licence', 'bac+3', 'bac +3', 'bac+2', 'bac +2'],
  master: ['master', 'bac+5', 'bac +5', 'bac+4', 'bac +4', 'mba'],
  doctorat: ['doctorat', 'these', 'phd'],
  other: [],
};

/**
 * Niveau d'expérience du profil → mots-clés attendus dans l'offre (§10).
 * Clés normalisées (normalizeText) miroirant JOB_LEVELS de constants.ts.
 * L'offre doit MENTIONNER le niveau pour que le bonus soit accordé : absence
 * d'information = pas de bonus (et pas de malus).
 */
export const EXPERIENCE_LEVEL_KEYWORDS: Record<string, string[]> = {
  junior: ['junior', 'debutant', 'entry level', '0 a 2 ans', '1 a 3 ans'],
  intermediaire: ['intermediaire', 'confirme', '2 a 5 ans', '3 ans d experience'],
  senior: ['senior', 'experimente', '5 a 10 ans', '5 ans d experience'],
  expert: ['expert', 'specialiste', '10 ans d experience', '10 ans'],
  manager: ['manager', 'chef d equipe', 'responsable', 'lead team'],
  'cadre dirigeant': ['directeur', 'direction', 'dga', 'general manager', 'president'],
};

// ---------------------------------------------------------------------------
//  Utilitaires
// ---------------------------------------------------------------------------

/** Normalise un texte : minuscules, sans accents, alphanumérique + espaces. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Vrai si `keyword` apparaît au DÉBUT d'un mot dans `haystack` (déjà normalisé).
 * Le préfixe est autorisé (« developpeur » matche « developpeurs ») mais
 * JAMAIS en milieu de mot (« veloppeur » ne matche pas « developpeur »).
 */
export function matchesKeyword(haystack: string, keyword: string): boolean {
  if (!haystack || !keyword) return false;
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(keyword)}`);
  return pattern.test(haystack);
}

/** Vrai si la localisation de l'offre correspond à la ville du profil. */
export function matchesCity(jobLocation: string | null | undefined, city: string | null | undefined): boolean {
  const loc = normalizeText(jobLocation);
  const target = normalizeText(city);
  if (!loc || !target) return false;
  // « abidjan plateau » contient « abidjan » → correspondance.
  return loc === target || loc.includes(target) || target.includes(loc);
}

function daysSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return (now.getTime() - t) / 86_400_000;
}

/** Vrai dès que le profil porte au moins un signal exploitable. */
export function hasProfileSignals(profile: RecommendationProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    (profile.city && profile.city.trim()) ||
      (profile.sectors && profile.sectors.length > 0) ||
      (profile.diploma && profile.diploma.trim()) ||
      (profile.contractTypes && profile.contractTypes.length > 0) ||
      (profile.skills && profile.skills.length > 0) ||
      (profile.experienceLevel && profile.experienceLevel.trim()),
  );
}

// ---------------------------------------------------------------------------
//  Scoring
// ---------------------------------------------------------------------------

/**
 * Score une offre par rapport au profil. Retourne un score additif + les
 * raisons (lisibles) ayant contribué au score.
 */
export function scoreJob(
  profile: RecommendationProfile | null | undefined,
  job: ScorableJob,
  now: Date = new Date(),
): JobScore {
  const reasons: string[] = [];
  const haystack = normalizeText(`${job.title} ${job.description ?? ''}`);
  const sectorSlugs = Array.isArray(profile?.sectors) ? profile!.sectors! : [];
  let matchedSector: string | undefined;

  if (sectorSlugs.length > 0) {
    // 1) Colonne `sector` renseignée → correspondance exacte (fiable).
    if (job.sector && sectorSlugs.includes(job.sector)) {
      matchedSector = job.sector;
    } else if (!job.sector && haystack) {
      // 2) Repli : mots-clés du secteur sur titre + description.
      for (const slug of sectorSlugs) {
        const entry = SECTOR_KEYWORDS[slug];
        if (entry && entry.keywords.some((kw) => matchesKeyword(haystack, normalizeText(kw)))) {
          matchedSector = slug;
          break;
        }
      }
    }
  }

  let score = 0;
  if (matchedSector) {
    score += RECOMMENDATION_WEIGHTS.sector;
    const entry = SECTOR_KEYWORDS[matchedSector];
    if (entry) reasons.push(`Domaine ${entry.label}`);
  }

  score += scoreExtras(profile, job, haystack, now, reasons);
  return { score, reasons, matchedSector };
}

/** Signaux secondaires (ville, contrat, diplôme, fraîcheur, vérification). */
function scoreExtras(
  profile: RecommendationProfile | null | undefined,
  job: ScorableJob,
  haystack: string,
  now: Date,
  reasons: string[],
): number {
  let score = 0;

  if (matchesCity(job.location, profile?.city)) {
    score += RECOMMENDATION_WEIGHTS.city;
    reasons.push('Dans votre ville');
  }

  const contractTypes = Array.isArray(profile?.contractTypes) ? profile!.contractTypes! : [];
  if (job.contract_type && contractTypes.includes(job.contract_type)) {
    score += RECOMMENDATION_WEIGHTS.contract;
    reasons.push(`Contrat ${job.contract_type}`);
  }

  // §10 — compétences : au moins une compétence du profil citée dans l'offre.
  const profileSkills = Array.isArray(profile?.skills) ? profile!.skills! : [];
  const matchedSkills = profileSkills
    .map((s) => (s || '').trim())
    .filter((s) => normalizeText(s).length >= 2)
    .filter((s) => matchesKeyword(haystack, normalizeText(s)));
  if (matchedSkills.length > 0) {
    score += RECOMMENDATION_WEIGHTS.skills;
    reasons.push(
      matchedSkills.length === 1
        ? `Compétence ${matchedSkills[0]}`
        : `Compétences ${matchedSkills.slice(0, 2).join(', ')}`,
    );
  }

  // §10 — expérience : le niveau du profil est explicitement demandé par
  // l'offre (junior / confirmé / senior / manager…).
  const level = normalizeText(profile?.experienceLevel);
  const levelKeywords = level ? EXPERIENCE_LEVEL_KEYWORDS[level] ?? [] : [];
  if (levelKeywords.length > 0 && levelKeywords.some((kw) => matchesKeyword(haystack, kw))) {
    score += RECOMMENDATION_WEIGHTS.experience;
    reasons.push(`Niveau ${profile!.experienceLevel!.trim()} recherché`);
  }

  const diplomaKeywords = profile?.diploma ? DIPLOMA_KEYWORDS[profile.diploma] ?? [] : [];
  if (diplomaKeywords.length > 0 && haystack) {
    if (diplomaKeywords.some((kw) => matchesKeyword(haystack, normalizeText(kw)))) {
      score += RECOMMENDATION_WEIGHTS.diploma;
      reasons.push('Adapté à votre diplôme');
    }
  }

  const age = daysSince(job.created_at, now);
  if (age !== null && age <= 7) {
    score += RECOMMENDATION_WEIGHTS.fresh7d;
    reasons.push('Publiée récemment');
  } else if (age !== null && age <= 30) {
    score += RECOMMENDATION_WEIGHTS.fresh30d;
  }

  if (job.is_verified) {
    score += RECOMMENDATION_WEIGHTS.verified;
  }

  return score;
}

function createdAtMs(job: ScorableJob): number {
  const t = job.created_at ? new Date(job.created_at).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

/**
 * Classe une liste d'offres par score décroissant, puis par date de création
 * décroissante (départage stable). Retourne des entrées { job, score, reasons }.
 */
export function rankJobs<T extends ScorableJob>(
  profile: RecommendationProfile | null | undefined,
  jobs: T[],
  limit?: number,
  now: Date = new Date(),
): Array<{ job: T; score: number; reasons: string[] }> {
  const scored = jobs.map((job) => {
    const s = scoreJob(profile, job, now);
    return { job, score: s.score, reasons: s.reasons };
  });

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return createdAtMs(b.job) - createdAtMs(a.job);
  });

  return typeof limit === 'number' ? scored.slice(0, limit) : scored;
}

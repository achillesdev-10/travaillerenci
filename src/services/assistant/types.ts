/**
 *  TravaillerEnCi — Assistant : types partagés
 *  Chemin : src/services/assistant/types.ts
 *
 *  Types utilisés par le pipeline de l'assistant (/api/assistant) et le
 *  composant client (AssistantFloat).
 */

/** Catégories de contenu que l'assistant sait rechercher. */
export type AssistantCategory =
  | 'job'
  | 'internship'
  | 'scholarship'
  | 'exam';

/** Une opportunité trouvée, prête à afficher sous forme de carte. */
export interface AssistantResult {
  id: string;
  title: string;
  /** Entreprise / organisme / organe organisateur. */
  subtitle: string;
  /** Localisation brute (ex : « Abidjan - Plateau »). */
  location: string;
  /** Ligne de métadonnées (ex : « CDI · Publié récemment »). */
  meta: string;
  /** URL interne du site (jamais inventée). */
  url: string;
  category: AssistantCategory;
}

/** Réponse du serveur vers le client. */
export interface AssistantReply {
  /** Texte principal de la réponse (peut contenir des sauts de ligne). */
  text: string;
  /** Résultats trouvés (3 à 5 max) — vide si aucun. */
  results: AssistantResult[];
  /** URL « Voir plus de résultats » (page du site), si pertinente. */
  seeMoreUrl?: string;
  /** Indique si l'IA (Gemini/Groq) a été utilisée pour cette réponse. */
  aiUsed?: boolean;
}

/** Réponse JSON complète de POST /api/assistant. */
export interface AssistantResponse {
  reply: AssistantReply;
}

/** Un message de l'historique client (limité, voir route). */
export interface AssistantHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Intention détectée de façon déterministe (sans IA). */
export type AssistantIntentKind =
  /** Réponse prédéfinie (FAQ). */
  | 'faq'
  /** Recherche directe dans la base. */
  | 'search'
  /** Demande complexe → IA (Gemini → Groq). */
  | 'ai';

/** Critères de recherche extraits par le détecteur d'intention. */
export interface AssistantSearchCriteria {
  /** Catégories demandées (emploi/stage/bourse/concours). Vide = toutes. */
  categories: AssistantCategory[];
  /** Ville / localisation détectée (Abidjan, Bouaké…), ou vide. */
  location?: string;
  /** Mot(s)-clé(s) complémentaires (domaine, intitulé…). */
  keywords: string[];
}

export interface AssistantIntent {
  kind: AssistantIntentKind;
  /** Clé de la réponse FAQ (uniquement si kind === 'faq'). */
  faqKey?: string;
  /** Critères de recherche (uniquement si kind === 'search'). */
  search?: AssistantSearchCriteria;
  /** Message utilisateur normalisé (minuscules, sans accents). */
  normalized: string;
}

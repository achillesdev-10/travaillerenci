/**
 *  TravaillerEnCi — src/types/social.ts
 *  Types du système de distribution sociale (Facebook / LinkedIn).
 *
 *  Miroir strict de la table `public.social_posts` (migration 0019) et de la
 *  table SQLite locale équivalente (voir src/services/social/socialPostService.ts).
 *
 *  Cycle de vie d'une tâche :
 *    queued → scheduled → publishing → published
 *                        ↘ failed (retry → scheduled)
 *    queued/scheduled → ignored | cancelled
 *
 *  Anti-doublon : UNIQUE (content_type, content_id, platform) — un contenu
 *  publié sur TravaillerEnCi ne peut avoir qu'UNE tâche par plateforme.
 */

/** Plateformes supportées. */
export type SocialPlatform = 'facebook' | 'linkedin';

/** Type de contenu source (miroir de ContentCategory). */
export type SocialContentType = 'job' | 'internship' | 'scholarship' | 'exam';

/** Statuts possibles d'une tâche sociale. */
export type SocialPostStatus =
  | 'queued' // en file d'attente, pas encore programmée
  | 'scheduled' // programmée (scheduled_at défini)
  | 'publishing' // en cours d'envoi (verrou anti-concurrence)
  | 'published' // publiée (ou simulée en dry-run)
  | 'failed' // échec définitif (retries épuisés)
  | 'ignored' // ignorée manuellement ou contenu expiré
  | 'cancelled'; // annulée manuellement

export interface SocialPost {
  id: string;
  content_type: SocialContentType;
  content_id: string;
  /** Intitulé du contenu (instantané au moment de l'enfilement, pour l'affichage admin). */
  content_title: string | null;
  platform: SocialPlatform;
  status: SocialPostStatus;
  /** Priorité déterministe (0-100) — voir src/services/social/priority.ts. */
  priority: number;
  text: string | null;
  image_url: string | null;
  link_url: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  error_code: string | null;
  error_message: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
  /** true si la tâche a été traitée en mode dry-run (aucun envoi réel). */
  dry_run: boolean;
  /** Dernier payload généré (texte, image, URL, payload plateforme) — aperçu admin. */
  payload_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

/** Payload d'aperçu généré (stocké dans payload_json). */
export interface SocialPreviewPayload {
  text: string;
  linkUrl: string;
  imageSvg: string;
  imageDataUri: string;
  platformPayload: Record<string, unknown>;
}

/** Filtres de listing admin. */
export interface SocialPostFilters {
  status?: SocialPostStatus | SocialPostStatus[];
  platform?: SocialPlatform;
  limit?: number;
  offset?: number;
}

/** État de connexion d'une plateforme (dashboard admin). */
export type ConnectionState = 'configured' | 'not_configured' | 'expired' | 'error';

export interface SocialConnectionStatus {
  platform: SocialPlatform;
  state: ConnectionState;
  label: string;
  detail: string;
}

/** Résumé des compteurs par statut (dashboard admin). */
export interface SocialStats {
  queued: number;
  scheduled: number;
  publishing: number;
  published: number;
  failed: number;
  ignored: number;
  cancelled: number;
  total: number;
}

/** Configuration effective du système (exposée à l'admin, jamais de secret). */
export interface SocialConfigSummary {
  dryRun: boolean;
  facebookDailyLimit: number;
  linkedinDailyLimit: number;
  maxRetries: number;
  publishSlots: string[];
  aiEnabled: boolean;
  facebookConfigured: boolean;
  linkedinConfigured: boolean;
}

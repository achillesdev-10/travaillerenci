/**
 *  TravaillerEnCi — Types du module « Alertes candidat »
 *  Miroir STRICT des tables `alerts` et `alert_digest_log` (SQLite / Supabase,
 *  migration 0017_alerts.sql).
 */

/** Types de contenu surveillés par une alerte. */
export type AlertContentType = 'job' | 'internship' | 'scholarship' | 'exam';

/** Canal de notification. */
export type AlertChannel = 'email' | 'whatsapp' | 'both';

/** Fréquence d'envoi : immédiat (après chaque cycle) ou récapitulatif quotidien. */
export type AlertFrequency = 'immediate' | 'daily';

export interface AlertItem {
  id: string;
  user_id: string;
  /** Libellé libre (ex. « Offres IT à Abidjan »). */
  label: string;
  /** Types de contenu inclus (vide = tous). */
  content_types: AlertContentType[];
  /** Ville cible (null = toutes). */
  city: string | null;
  /** Diplôme minimum souhaité (BAC, Licence, Master… — null = tous). */
  diploma: string | null;
  /** Secteur d'intérêt (slug SECTORS de src/lib/constants.ts — null = tous). */
  sector: string | null;
  channels: AlertChannel;
  frequency: AlertFrequency;
  active: boolean;
  /** Jeton de désinscription (unique, envoyé dans chaque notification). */
  unsubscribe_token: string;
  /** Dernier envoi effectif (utilisé pour la fréquence quotidienne). */
  last_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Patch partiel accepté par PATCH /api/alerts. */
export interface AlertPatch {
  label?: string;
  content_types?: AlertContentType[];
  city?: string | null;
  diploma?: string | null;
  sector?: string | null;
  channels?: AlertChannel;
  frequency?: AlertFrequency;
  active?: boolean;
}

/** Payload de création POST /api/alerts. */
export interface AlertCreateInput {
  label: string;
  content_types?: AlertContentType[];
  city?: string | null;
  diploma?: string | null;
  sector?: string | null;
  channels?: AlertChannel;
  frequency?: AlertFrequency;
}

/** Trace d'envoi (déduplication : une ligne par (alerte, élément)). */
export interface AlertDigestLogEntry {
  id: string;
  alert_id: string;
  item_type: AlertContentType;
  item_id: string;
  sent_at: string;
}

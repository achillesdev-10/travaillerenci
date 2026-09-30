/**
 *  TravaillerEnCi — src/lib/profileVisibility.ts
 *
 *  Consentement de visibilité du profil candidat (master prompt §30 —
 *  préparation de la future CVthèque).
 *
 *  Règle de sécurité : PAR DÉFAUT le profil est privé. Seul un choix
 *  explicite du candidat (`'recruiters'`) autorise un futur accès recruteur.
 *  Aucun accès public aux données privées (email, téléphone, CV).
 *
 *  Module PUR → testable directement.
 */

export const PROFILE_VISIBILITY_VALUES = ['private', 'recruiters'] as const;

export type ProfileVisibility = (typeof PROFILE_VISIBILITY_VALUES)[number];

/** Défaut de sécurité : profil privé. */
export const DEFAULT_PROFILE_VISIBILITY: ProfileVisibility = 'private';

export function isProfileVisibility(value: unknown): value is ProfileVisibility {
  return (
    typeof value === 'string' &&
    (PROFILE_VISIBILITY_VALUES as readonly string[]).includes(value)
  );
}

/**
 * Normalise une valeur quelconque en consentement valide.
 * Toute valeur inconnue retombe sur le défaut « privé » (jamais exposé
 * par accident).
 */
export function normalizeProfileVisibility(value: unknown): ProfileVisibility {
  return isProfileVisibility(value) ? value : DEFAULT_PROFILE_VISIBILITY;
}

/** Vrai uniquement si le candidat a explicitement choisi d'être visible. */
export function isRecruiterVisible(value: unknown): boolean {
  return normalizeProfileVisibility(value) === 'recruiters';
}

/** Libellés UI (FR). */
export const PROFILE_VISIBILITY_LABELS: Record<ProfileVisibility, string> = {
  private: 'Profil privé',
  recruiters: 'Visible par les recruteurs',
};

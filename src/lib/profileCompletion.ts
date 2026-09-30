/**
 *  TravaillerEnCi — src/lib/profileCompletion.ts
 *
 *  Calcul de l'indicateur « Profil complété à X % » et de la liste des
 *  éléments manquants (master prompt §9).
 *
 *  Module PUR (aucun import serveur / Next) → directement testable.
 *  Pondération volontairement simple : chaque critère pèse pareil.
 */

export interface CompletionInput {
  email?: string | null;
  city?: string | null;
  jobTitle?: string | null;
  sectors?: string[] | null;
  diploma?: string | null;
  experienceLevel?: string | null;
  skills?: string[] | null;
  contractTypes?: string[] | null;
  phone?: string | null;
  bio?: string | null;
  resumeUrl?: string | null;
}

export interface CompletionItem {
  key: string;
  label: string;
  done: boolean;
}

export interface CompletionResult {
  /** Pourcentage entier 0–100. */
  percent: number;
  /** Nombre de critères satisfaits. */
  done: number;
  /** Nombre total de critères. */
  total: number;
  /** Tous les critères, dans l'ordre d'affichage. */
  items: CompletionItem[];
  /** Libellés des critères restants (pour les suggestions). */
  missingLabels: string[];
}

function hasText(value: string | null | undefined): boolean {
  return Boolean(value && String(value).trim().length > 0);
}

function hasItems(value: string[] | null | undefined): boolean {
  return Array.isArray(value) && value.length > 0;
}

/** Calcule la complétion du profil candidat. */
export function computeProfileCompletion(input: CompletionInput | null | undefined): CompletionResult {
  const data = input ?? {};

  const items: CompletionItem[] = [
    { key: 'email', label: 'Email', done: hasText(data.email) },
    { key: 'city', label: 'Ville', done: hasText(data.city) },
    { key: 'job_title', label: 'Métier recherché', done: hasText(data.jobTitle) },
    { key: 'sectors', label: "Domaines d'intérêt", done: hasItems(data.sectors) },
    { key: 'diploma', label: 'Diplôme', done: hasText(data.diploma) },
    { key: 'experience_level', label: "Niveau d'expérience", done: hasText(data.experienceLevel) },
    { key: 'skills', label: 'Compétences', done: hasItems(data.skills) },
    { key: 'contract_types', label: 'Type de contrat recherché', done: hasItems(data.contractTypes) },
    { key: 'phone', label: 'Téléphone WhatsApp', done: hasText(data.phone) },
    { key: 'bio', label: 'Présentation', done: hasText(data.bio) },
    { key: 'resume_url', label: 'CV (lien)', done: hasText(data.resumeUrl) },
  ];

  const done = items.filter((i) => i.done).length;
  const total = items.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return {
    percent,
    done,
    total,
    items,
    missingLabels: items.filter((i) => !i.done).map((i) => i.label),
  };
}

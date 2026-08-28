/**
 * TravaillerEnCi — Utilitaire d'export CSV partagé pour l'admin.
 * Utilisé par les pages users, exams, recruiters, reports, etc.
 */

/** Échappe une cellule CSV contre l'injection de formule (= + - @ tab CR). */
export function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(value)) {
    return `"'"${escaped}"`;
  }
  return `"${escaped}"`;
}

/**
 * Génère et télécharge un fichier CSV à partir d'en-têtes et de lignes.
 * @param filename - Nom du fichier (sans extension)
 * @param headers - En-têtes de colonnes
 * @param rows - Données (chaque ligne est un tableau de chaînes)
 */
export function downloadCsv(
  filename: string,
  headers: string[],
  rows: string[][],
): void {
  const csv = [
    headers.join(';'),
    ...rows.map((row) => row.join(';')),
  ].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Formatte une date ISO en date lisible fr-FR. */
export function formatDate(isoDate: string | null): string {
  if (!isoDate) return '—';
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(parsed);
}

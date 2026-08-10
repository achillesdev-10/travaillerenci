export function cn(...classes: Array<string | undefined | null | false>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(date: string | Date, locale: string = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateShort(date: string | Date, locale: string = 'fr-FR'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * « il y a Xh » — durée écoulée depuis la date passée en paramètre.
 *
 * IMPORTANT (sémantique) : dans les cartes d'offres/concours, `date` est
 * TOUJOURS `created_at` côté TravaillerEnCi = la date de 1ᵉʳ ajout sur la
 * plateforme (SQLite `datetime('now')` / Supabase timestamptz `NOW()`), posée
 * à l'insertion et conservée par les mises à jour du scraper. Ce n'est jamais
 * la date de publication de l'annonce sur le site source — un « il y a 15h »
 * juste après un scraping frais signifie donc simplement que l'offre existait
 * déjà au cycle précédent (comportement voulu, pas un signe d'inactivité).
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);
  const diffYear = Math.floor(diffDay / 365);

  if (diffSec < 60) return 'à l\'instant';
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffHour < 24) return `il y a ${diffHour} h`;
  if (diffDay < 7) return `il y a ${diffDay} j`;
  if (diffWeek < 4) return `il y a ${diffWeek} sem`;
  if (diffMonth < 12) return `il y a ${diffMonth} mois`;
  return `il y a ${diffYear} an${diffYear > 1 ? 's' : ''}`;
}

export function formatCurrency(
  amount: number,
  currency: string = 'FCFA',
  locale: string = 'fr-FR'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency === 'FCFA' ? 'XOF' : currency,
    maximumFractionDigits: 0,
  })
    .format(amount)
    .replace('XOF', currency);
}

export function formatRange(
  min?: number,
  max?: number,
  currency: string = 'FCFA',
  suffix?: string
): string {
  if (!min && !max) return 'Non communiqué';
  const parts: string[] = [];
  if (min) parts.push(formatCurrency(min, currency));
  if (max) parts.push(formatCurrency(max, currency));
  const result = parts.join(' - ');
  return suffix ? `${result} ${suffix}` : result;
}

export function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
}

export function capitalize(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function fullName(firstName?: string, lastName?: string): string {
  const parts: string[] = [firstName, lastName].filter((v): v is string => Boolean(v));
  return parts.map((p) => capitalize(p)).join(' ').trim();
}

export function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  const masked = name.length > 3
    ? name.slice(0, 3) + '*'.repeat(name.length - 3)
    : '*'.repeat(name.length);
  return `${masked}@${domain}`;
}

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return phone;
  return digits.slice(0, 3) + '*'.repeat(digits.length - 5) + digits.slice(-2);
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhoneCI(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return /^225\d{8}$/.test(digits) || /^\d{10}$/.test(digits) || /^\d{8}$/.test(digits);
}

export function generateId(prefix: string = ''): string {
  const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  return prefix ? `${prefix}_${id}` : id;
}

export function debounce<T extends (...args: Parameters<T>) => void>(
  fn: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function groupBy<T, K extends keyof T>(arr: T[], key: K): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = String(item[key]);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export function paginate<T>(arr: T[], page: number = 1, limit: number = 10) {
  const safePage = Math.max(1, page);
  const safeLimit = Math.max(1, limit);
  const start = (safePage - 1) * safeLimit;
  const end = start + safeLimit;
  return {
    data: arr.slice(start, end),
    total: arr.length,
    page: safePage,
    limit: safeLimit,
    total_pages: Math.ceil(arr.length / safeLimit),
  };
}

export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

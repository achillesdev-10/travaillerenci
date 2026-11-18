/**
 * TravaillerEnCi — scripts/audit-check.mjs
 *
 * Garde-fou de dépendances pour la CI (job `audit` de .github/workflows/scraper.yml).
 *
 * Équivalent de `npm audit --audit-level=high`, avec une liste d'exceptions
 * EXPLICITES, DATÉES et justifiées. Toute vulnérabilité high/critical qui
 * n'est pas couverte par une exception ci-dessous fait échouer le job.
 *
 * Justification de l'exception actuelle (18/11/2026) :
 *   GHSA-fc5q-39xc-vjpf / CVE-2026-112366 — « picomatch ReDoS via single-branch
 *   repeated extglobs ». L'avis a été RETIRÉ (withdrawn) par GitHub le
 *   18/11/2026 : https://github.com/advisories/GHSA-fc5q-39xc-vjpf
 *   Le mainteneur de picomatch le qualifie de faux positif (motifs glob =
 *   expressions régulières ; problème général de hauteur d'étoile non résolu) :
 *   https://github.com/micromatch/picomatch/pull/235#issuecomment-6315749381
 *   Aucune version corrigée n'existe (dernière version publiée : 4.0.7, qui
 *   reste dans la plage signalée) et `npm audit fix --force` ne propose qu'un
 *   rétrogradage cassant vers eslint-config-next@14. Ce n'est donc pas
 *   corrigeable sans détruire la stack Next 16 / React 19 / ESLint 10.
 *
 *   picomatch n'est atteint que par l'outillage de développement
 *   (eslint-config-next → @next/eslint-plugin-next / typescript-eslint →
 *   tinyglobby / fdir ; fast-glob → micromatch). Aucun chemin de production.
 *
 * CONDITION DE RETRAIT : supprimer l'entrée de ALLOWED_ADVISORIES dès que
 *   - le registre npm ne renvoie plus cet avis, OU
 *   - une version corrigée de picomatch est publiée et installable.
 * La date d'expiration force la revue même si personne ne pense à le faire.
 *
 * Tests : tests/auditCheck.test.ts (aucun accès réseau, npm audit simulé).
 */

import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const ALLOWED_ADVISORIES = [
  {
    id: 'GHSA-fc5q-39xc-vjpf',
    reason:
      'Avis retiré (withdrawn) le 18/11/2026, aucune version corrigée, faux positif contesté en amont.',
    expires: '2026-12-18',
  },
];

export const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function findAllowance(id, allowed = ALLOWED_ADVISORIES) {
  return allowed.find((entry) => entry.id === id);
}

/**
 * 'allowed' tant que today < expires ; 'expired' dès le début de la date
 * d'expiration (today >= expires) ; 'unknown' si l'avis n'est pas listé.
 */
export function allowanceStatus(
  id,
  { allowed = ALLOWED_ADVISORIES, today = todayIso() } = {},
) {
  const entry = findAllowance(id, allowed);
  if (!entry) return 'unknown';
  return today < entry.expires ? 'allowed' : 'expired';
}

export function isAllowed(id, options = {}) {
  return allowanceStatus(id, options) === 'allowed';
}

export function advisoryId(via) {
  if (via && typeof via === 'object' && via.url) {
    return via.url.split('/').filter(Boolean).pop();
  }
  if (via && typeof via === 'object' && via.source) {
    return String(via.source);
  }
  return null;
}

function emptyOutcome(reason, extra = {}) {
  return {
    ok: false,
    reason,
    blocking: [],
    ignored: 0,
    advisories: new Map(),
    expiredAdvisories: new Set(),
    meta: {},
    ...extra,
  };
}

export function evaluateReport(report, options = {}) {
  const { allowed = ALLOWED_ADVISORIES, today = todayIso() } = options;
  const opts = { allowed, today };

  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return emptyOutcome('invalid-report');
  }
  if (report.error) {
    return emptyOutcome('audit-error', { message: report.error });
  }

  const vulnerabilities = report.vulnerabilities ?? {};
  const names = Object.keys(vulnerabilities);
  const expiredAdvisories = new Set();

  const resolved = new Map();
  function isFullyExplained(name, stack = new Set()) {
    if (resolved.has(name)) return resolved.get(name);
    if (stack.has(name)) return false;
    const vuln = vulnerabilities[name];
    if (!vuln) return false;

    stack.add(name);
    const vias = Array.isArray(vuln.via) ? vuln.via : [];
    let explained = vias.length > 0;

    for (const via of vias) {
      if (typeof via === 'string') {
        if (!isFullyExplained(via, stack)) {
          explained = false;
          break;
        }
      } else {
        const id = advisoryId(via);
        const severity = via?.severity ?? vuln.severity;
        if (!BLOCKING_SEVERITIES.has(severity)) continue;

        const status = id ? allowanceStatus(id, opts) : 'unknown';
        if (status === 'expired') expiredAdvisories.add(id);
        if (status !== 'allowed') {
          explained = false;
          break;
        }
      }
    }

    stack.delete(name);
    resolved.set(name, explained);
    return explained;
  }

  const blocking = [];
  let ignored = 0;
  for (const name of names) {
    const vuln = vulnerabilities[name];
    if (!BLOCKING_SEVERITIES.has(vuln.severity)) continue;
    if (isFullyExplained(name)) {
      ignored += 1;
    } else {
      blocking.push({ name, severity: vuln.severity, range: vuln.range });
    }
  }

  const advisories = new Map();
  for (const vuln of Object.values(vulnerabilities)) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || via === null) continue;
      const id = advisoryId(via);
      if (id) advisories.set(id, via);
    }
  }

  return {
    ok: blocking.length === 0,
    reason: blocking.length === 0 ? 'ok' : 'blocking',
    blocking,
    ignored,
    advisories,
    expiredAdvisories,
    meta: report.metadata?.vulnerabilities ?? {},
  };
}

export function evaluateCommand(result, options = {}) {
  if (!result || result.error) {
    return emptyOutcome('spawn-error', {
      message: result?.error?.message ?? "npm audit n'a pas pu être exécuté",
    });
  }
  if (typeof result.stdout !== 'string' || result.stdout.trim() === '') {
    return emptyOutcome('invalid-json', { raw: result.stdout ?? '' });
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return emptyOutcome('invalid-json', { raw: result.stdout });
  }

  return evaluateReport(report, options);
}

function printOutcome(outcome, today) {
  if (outcome.reason === 'spawn-error') {
    console.error(`[audit] Impossible d'exécuter npm audit : ${outcome.message}`);
    return;
  }
  if (outcome.reason === 'invalid-json') {
    console.error('[audit] Sortie npm audit illisible (ni JSON ni rapport exploitable).');
    if (outcome.raw) console.error(outcome.raw.trim());
    return;
  }
  if (outcome.reason === 'audit-error') {
    console.error(`[audit] npm audit a échoué : ${JSON.stringify(outcome.message)}`);
    return;
  }
  if (outcome.reason === 'invalid-report') {
    console.error('[audit] Rapport npm audit invalide (objet attendu).');
    return;
  }

  const { meta } = outcome;
  console.log(
    `[audit] Rapport npm : ${meta.total ?? 0} vulnérabilité(s) ` +
      `(high: ${meta.high ?? 0}, critical: ${meta.critical ?? 0}).`,
  );

  for (const [id, advisory] of outcome.advisories) {
    const entry = findAllowance(id);
    if (!entry) continue;
    const status = allowanceStatus(id, { today });
    console.log(
      `[audit] Exception ${status === 'allowed' ? 'active' : 'EXPIRÉE'} : ` +
        `${id} — ${advisory.title}`,
    );
    console.log(`[audit]   Justification : ${entry.reason}`);
    console.log(`[audit]   Expire le : ${entry.expires}`);
  }

  console.log(
    `[audit] ${outcome.ignored} vulnérabilité(s) high/critical couverte(s) ` +
      'par une exception datée.',
  );

  if (outcome.blocking.length > 0) {
    console.error(
      `[audit] ÉCHEC : ${outcome.blocking.length} vulnérabilité(s) ` +
        'high/critical non couverte(s) :',
    );
    for (const entry of outcome.blocking) {
      console.error(`  - ${entry.name} (${entry.severity}, plage ${entry.range})`);
    }
    return;
  }

  const stale = ALLOWED_ADVISORIES.filter((entry) => !outcome.advisories.has(entry.id));
  for (const entry of stale) {
    console.log(
      `[audit] Exception devenue inutile (${entry.id}) : ` +
        'à retirer de scripts/audit-check.mjs.',
    );
  }

  console.log(
    '[audit] OK : aucune vulnérabilité high/critical hors exceptions documentées.',
  );
}

export function run() {
  const today = todayIso();
  const result = spawnSync('npm audit --json', {
    encoding: 'utf8',
    shell: true,
  });
  const outcome = evaluateCommand(result, { today });
  printOutcome(outcome, today);
  process.exit(outcome.ok ? 0 : 1);
}

const isDirectRun =
  Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  run();
}

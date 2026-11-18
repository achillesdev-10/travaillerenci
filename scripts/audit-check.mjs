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
 */

import { spawnSync } from 'node:child_process';

const ALLOWED_ADVISORIES = [
  {
    id: 'GHSA-fc5q-39xc-vjpf',
    reason:
      'Avis retiré (withdrawn) le 18/11/2026, aucune version corrigée, faux positif contesté en amont.',
    expires: '2026-12-18',
  },
];

const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function findAllowance(id) {
  return ALLOWED_ADVISORIES.find((entry) => entry.id === id);
}

function isAllowed(id) {
  const entry = findAllowance(id);
  if (!entry) return false;
  const expired = todayIso() > entry.expires;
  if (expired) {
    console.error(
      `[audit] L'exception ${id} a expiré le ${entry.expires} : revue obligatoire.`,
    );
  }
  return !expired;
}

function advisoryId(via) {
  if (via && typeof via === 'object' && via.url) {
    return via.url.split('/').filter(Boolean).pop();
  }
  if (via && typeof via === 'object' && via.source) {
    return String(via.source);
  }
  return null;
}

function main() {
  const command = 'npm audit --json';
  const result = spawnSync(command, {
    encoding: 'utf8',
    shell: true,
  });

  if (result.error) {
    console.error(`[audit] Impossible d'exécuter npm audit : ${result.error.message}`);
    process.exit(1);
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error('[audit] Sortie npm audit illisible (ni JSON ni rapport exploitable).');
    if (result.stdout) console.error(result.stdout.trim());
    if (result.stderr) console.error(result.stderr.trim());
    process.exit(1);
  }

  if (report.error) {
    console.error(`[audit] npm audit a échoué : ${JSON.stringify(report.error)}`);
    process.exit(1);
  }

  const vulnerabilities = report.vulnerabilities ?? {};
  const names = Object.keys(vulnerabilities);

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
        if (BLOCKING_SEVERITIES.has(severity) && !(id && isAllowed(id))) {
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

  const advisoryObjects = new Map();
  for (const vuln of Object.values(vulnerabilities)) {
    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object') continue;
      const id = advisoryId(via);
      if (id) advisoryObjects.set(id, via);
    }
  }

  const meta = report.metadata?.vulnerabilities ?? {};
  console.log(
    `[audit] Rapport npm : ${meta.total ?? 0} vulnérabilité(s) ` +
      `(high: ${meta.high ?? 0}, critical: ${meta.critical ?? 0}).`,
  );

  for (const [id, advisory] of advisoryObjects) {
    const allowance = findAllowance(id);
    if (allowance) {
      const active = isAllowed(id);
      console.log(
        `[audit] Exception ${active ? 'active' : 'EXPIRÉE'} : ${id} — ${advisory.title}`,
      );
      console.log(`[audit]   Justification : ${allowance.reason}`);
      console.log(`[audit]   Expire le : ${allowance.expires}`);
    }
  }

  console.log(
    `[audit] ${ignored} vulnérabilité(s) high/critical couverte(s) par une exception datée.`,
  );

  if (blocking.length > 0) {
    console.error(
      `[audit] ÉCHEC : ${blocking.length} vulnérabilité(s) high/critical non couverte(s) :`,
    );
    for (const entry of blocking) {
      console.error(`  - ${entry.name} (${entry.severity}, plage ${entry.range})`);
    }
    process.exit(1);
  }

  if (ignored === 0) {
    const stale = ALLOWED_ADVISORIES.filter((entry) => !advisoryObjects.has(entry.id));
    for (const entry of stale) {
      console.log(
        `[audit] Exception devenue inutile (${entry.id}) : à retirer de scripts/audit-check.mjs.`,
      );
    }
  }

  console.log(
    '[audit] OK : aucune vulnérabilité high/critical hors exceptions documentées.',
  );
}

main();

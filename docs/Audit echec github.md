# Rapport — Échec GitHub Actions / npm audit (18 novembre 2026)

- **Dépôt** : achillesdev-10/travaillerenci
- **Branche** : `sprint-1.3-validation-production` (aucun travail sur `main`)
- **Run concerné** : https://github.com/achillesdev-10/travaillerenci/actions/runs/44345590765
- **Job en échec** : `audit` (`npm audit --audit-level=high`)
- **Commit de correction** : `af23e3f9e52bccf5951aab338020dcb4be8821aa`
- **Commit de ce rapport** : commit suivant (`git log -1`)

---

## 1. Diagnostic

### Nombre de vulnérabilités initiales

`npm audit` / `npm audit --json` :

| Sévérité | Nombre |
| --- | --- |
| critical | 0 |
| high | **14** |
| moderate | 0 |
| low | 0 |
| info | 0 |
| **Total** | **14** |

Les 14 entrées proviennent **d'une seule et même alerte**, propagée dans l'arbre de dépendances.

### Origine exacte

- **Avis** : GHSA-fc5q-39xc-vjpf / CVE-2026-112366
- **Titre** : « picomatch vulnerable to ReDoS through single-branch repeated extglobs »
- **Paquet source** : `picomatch`
- **Plage signalée** : `<= 4.0.7`
- **Sévérité** : high (CVSS 3.1 : 7.5)

**Fait déterminant** : cet avis a été **retiré (withdrawn) par GitHub le 18 novembre 2026**.
Source : https://github.com/advisories/GHSA-fc5q-39xc-vjpf

Le mainteneur de `picomatch` conteste la vulnérabilité (les globs sont des expressions
régulières ; problème général de hauteur d'étoile non résolu) et a fermé le correctif
proposé sans le fusionner :
https://github.com/micromatch/picomatch/pull/235#issuecomment-6315749381

**Aucune version corrigée n'existe** : la dernière version publiée est `4.0.7`, encore
dans la plage signalée. `npm audit fix --force` ne « corrige » le problème qu'en
rétrogradant vers `eslint-config-next@14.2.35`, ce qui casse la stack Next.js 16 /
React 19 / ESLint 10.

### Chemins de dépendances (tous en développement, aucun en production)

```
eslint-config-next@16.4.6
├── @next/eslint-plugin-next@16.4.6
│   └── fast-glob@3.3.1
│       └── micromatch@4.0.8
│           └── picomatch@2.3.2
├── eslint-import-resolver-typescript@3.10.1
│   └── tinyglobby@0.2.17
│       ├── picomatch@4.0.7
│       └── fdir@6.5.0 (peer picomatch ^3 || ^4 → 4.0.7 dédupliqué)
└── typescript-eslint@8.72.2
    └── @typescript-eslint/typescript-estree@8.72.2
        └── tinyglobby@0.2.17 (dédupliqué)
```

Paquets marqués high par propagation : `@next/eslint-plugin-next`, `@typescript-eslint/*`,
`eslint-config-next`, `eslint-import-resolver-typescript`, `fast-glob`, `fdir`,
`micromatch`, `picomatch`, `tinyglobby`, `typescript-eslint`.

### Versions réellement installées (avant = après)

| Paquet | Version |
| --- | --- |
| next | 16.4.6 |
| react | 19.2.8 |
| react-dom | 19.2.8 |
| eslint | 10.14.0 |
| eslint-config-next | 16.4.6 |
| typescript | 6.0.3 |
| picomatch (branche 2.x) | 2.3.2 |
| picomatch (branche 4.x) | 4.0.7 |

Aucune de ces versions n'a été modifiée.

---

## 2. Correction appliquée

### Ce qui n'a **pas** été fait (volontairement)

- Aucun `npm audit fix --force` (seul un `--dry-run` a été exécuté ; il n'a modifié
  aucun fichier — `package-lock.json` est inchangé).
- Aucun rétrogradage de Next.js, React, ESLint, `eslint-config-next` ou TypeScript.
- Aucun `override` global de `picomatch` : aucune version corrigée n'existe et forcer
  une version incompatible casserait `micromatch` (attendu en `^2.3.1`) ou `fdir`
  (attendu en `^3 || ^4`).
- Aucune suppression de fonctionnalité, aucune modification Supabase, aucun déploiement.

### Ce qui a été fait

1. **`scripts/audit-check.mjs`** (nouveau) : garde-fou CI qui exécute `npm audit --json`
   et **conserve le seuil high/critical**. Il ne tolère qu'une liste d'exceptions
   explicites, datées et justifiées. Toute autre vulnérabilité high/critical fait
   échouer le job (vérifié par test négatif).
2. **Exception documentée** pour `GHSA-fc5q-39xc-vjpf` uniquement :
   - justification : avis retiré le 18/11/2026, aucune version corrigée publiée,
     faux positif contesté en amont ;
   - **date d'expiration : 2026-12-18** (échec automatique après cette date) ;
   - condition de retrait : suppression de l'entrée dès que le registre npm ne renvoie
     plus l'avis ou qu'une version corrigée est publiée.
3. **`.github/workflows/scraper.yml`** : le job `audit` exécute désormais
   `npm run audit:ci` (au lieu de `npm audit --audit-level=high` brut). Le job reste
   actif, au même seuil, sans installation de `node_modules` (audit basé sur le
   lockfile).
4. **`package.json`** : ajout du script `audit:ci`.

### Overrides

Aucun override ajouté ni supprimé. Les 3 overrides `minimatch` existants sont conservés
(`@eslint/config-array`, `eslint`, `@typescript-eslint/typescript-estree`).

### Versions avant / après

Identiques (voir tableau ci-dessus). Seuls des fichiers CI/documentation ont changé.

---

## 3. Résultats des vérifications

| Commande | Résultat |
| --- | --- |
| `npm ci` | ✅ OK — 401 paquets, lockfile cohérent |
| `npm run audit:ci` | ✅ **exit 0** — 14 high couvertes par l'exception datée, 0 bloquante |
| `npm audit` | ⚠️ 14 high (l'avis retiré est **encore servi par le registre npm**) |
| `npm audit --audit-level=high` | ⚠️ exit 1 (même avis retiré, pas encore purgé du registre) |
| `npm run lint` | ✅ exit 0 — 0 erreur, 5 warnings (fichiers non suivis `.audit-tmp/`, hors commit) |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npm test` | ✅ exit 0 — toutes les suites, dont 64 assertions « carnet de candidatures » |
| `npm run build` | ✅ exit 0 — build Next.js complet |

### Note importante sur `npm audit`

`npm audit` brut continue d'afficher 14 high **uniquement parce que le registre npm
n'a pas encore purgé l'avis retiré** (vérifié directement sur l'endpoint
`registry.npmjs.org/-/npm/v1/security/advisories/bulk` le 18/11/2026). Dès que le
registre applique le retrait, la sortie passera à 0 sans aucune modification du projet.
Le garde-fou CI (`npm run audit:ci`) applique déjà la décision de sécurité réelle :
0 vulnérabilité high/critical non couverte.

### Environnement local

`npm ci` a d'abord échoué en `EPERM` sur `lightningcss.win32-x64-msvc.node`, fichier
verrouillé par un serveur `next dev` local. Le serveur de développement local a été
arrêté, puis `npm ci` a réussi. Ce problème est purement local (Windows), sans rapport
avec la CI Linux. Relancer `npm run dev` si nécessaire.

---

## 4. Workflow GitHub

- `audit` : `npm run audit:ci` — seuil high/critical maintenu, exceptions datées.
- `lint-and-typecheck` : `npm ci` → `npm run lint` → `npx tsc --noEmit` → tests concours.
- `scrape-content` : uniquement sur `schedule` ou `workflow_dispatch` (aucun scraping
  déclenché par ce correctif).
- Aucun secret GitHub modifié.

---

## 5. Sauvegarde GitHub

- Branche conservée : `sprint-1.3-validation-production`.
- Commit de correction : `af23e3f9e52bccf5951aab338020dcb4be8821aa`
  (`fix(deps): handle withdrawn picomatch high advisory in npm audit gate`).
- Commit de ce rapport : commit suivant sur la même branche.
- Push : effectué sur `origin/sprint-1.3-validation-production` (sans `--force`).
- Aucune Pull Request fusionnée, aucun déploiement Vercel, aucune modification Supabase
  ni de la production.

---

## 6. Risque résiduel et solution propre

- Risque réel : **nul pour la production**. `picomatch` n'est atteint que par
  l'outillage ESLint/TypeScript de développement, et l'avis est retiré.
- Solution propre à court terme : exception datée (appliquée), expirant le **2026-12-18**.
- Solution de sortie : retirer l'exception dès que le registre npm purge l'avis retiré
  (aucun changement de dépendance requis) ou, si une version corrigée de `picomatch`
  est publiée, mettre à jour via les plages existantes (`^2.3.1` / `^4.0.4`) sans
  override global.

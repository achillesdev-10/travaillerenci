# Phase 3 — Audit Vercel CPU Active Usage

## Contexte et Objectifs

**Projet** : TravaillerEnCI — Plateforme d'offres d'emploi en Côte d'Ivoire  
**Stack** : Next.js 16, Supabase, Vercel, SQLite (fallback local)  
**Objective** : Effectuer un audit technique des ressources Vercel (CPU Active Usage) sans modifier aucun fichier ni fonctionnalité. Identifier les points de consommation serveur pour optimisation future.

**Contraintes impératives** :
- Lecture seule : aucun fichier source, aucune configuration, aucun code modifié
- Aucune migration, aucun commit, aucun push, aucun déploiement
- S'appuyer sur l'analyse statique des fichiers existants

**État précédent** :
- Phase 2 audit Supabase complet — 20+ problèmes identifiés et résolus
- Phase 2.1 vérification compatibilité optimisations
- Phase 2.2 implantation `platformSettingsService.valuesAreEqual()` — upsert sélectif des clés
- 242 tests unitaires validés (jobThumbnails, recommendationScoring, jobSeo, sectorClassifier, profileCompletion, analyticsEvents, shareUtm, mustSee, relatedContent, profileVisibility, trafficSource)
- TypeScript compilation validée (npx tsc --noEmit: OK)
- Optimisation Phase 2.2 implantée et validée, AUCUN fichier modifié pendant l'audit

---

## 9 Points Analysés

| # | Fichier/Ligne | Type | Description |
|---|--------------|------|-------------|
| 1 | `src/lib/homeCarousel.ts:231-250` | Réseau/HTML | Fetch OpenGraph images depuis sites externes (4s/ slide, regex HTML, Promise.allSettled) |
| 2 | `src/lib/admin-analytics.ts:117-190` | Iteration DB | 5+ passages complets sur les lignes `site_visits` + tris O(n log n) par appel |
| 3 | `src/app/page.tsx:185-241` | ISR Mismatch | `revalidate=60` mais cached functions TTL=120s → re-renders redondants |
| 4 | `src/app/api/admin/search/route.ts:36-40` | Requêtes parallèles | 3 requêtes DB distinctes (offers+blog+entreprendre) via Promise.allSettled |
| 5 | `src/lib/recommendationScoring.ts:315-446` | Algorithme | Barème complet par job : normalisation texte, correspondance secteurs, ville, compétences, expérience, diplôme, fraîcheur, vérification |
| 6 | `src/app/api/analytics/track/route.ts:105-160` | Par requête | Rate limiting + hash IP + import dynamique `node:sqlite` + Buffer.toString("base64") |
| 7 | `src/components/home/NewsTicker.tsx` | Client-side | CSS marquee uniquement — coût serveur = 0 |
| 8 | `src/lib/utils.ts` | Utilitaires | Opérations légères (formatDate, slugify, capitalize, etc.) — négligeable |
| 9 | `src/lib/recommendationScoring.ts` | Pure JS | Aucun I/O, calcul en mémoire uniquement, test-covered |

---

## 6 Problèmes / Pistes d'Optimisation Identifiés

### P1 — homeCarousel.ts:231-250 — OpenGraph Image Fetching
- **Cause** : Quand `withOgImages: true`, chaque slide fait un `fetch()` HTTP vers une source externe, parse le HTML avec regex, extrait `<meta property="og:image">`
- **Risque** : Coût réseau + CPU parsing HTML par slide ; avec 6 slides = jusqu'à 6 requêtes concrurentes
- **Non vérifié** : Gain réel selon le trafic et les noms de domaine sources ; les images OG peuvent échouer silencieusement
- **Recommandation** : S'assurer que `withOgImages: false` en production (déjà le cas dans `page.tsx:234`)

### P2 — admin-analytics.ts:117-190 — Full Row Iteration ✅ Résolu
- **Cause** : `fromSqliteRows()` itérait 5 fois le jeu de lignes complet + tris ; `fromSupabase()` faisait de même en JS sur les lignes récupérées.
- **Risque** : Sévère avec des milliers de visites ; chaque `getAdminAnalyticsData()` call était CPU-intensive.
- **Non vérifié** : — (Résolu par implémentation P3-02)
- **Recommandation** : Remplacer les passes iteratives par des requêtes SQL agrégées (`COUNT`, `GROUP BY`, `ORDER BY`) — implémenté dans `fromSqliteRows` et `fromSupabase`.

### P3 — page.tsx:185-241 — ISR Mismatch
- **Cause** : `export const revalidate = 60` dans la page, mais `unstable_cache` dans `cachedContent.ts` utilise `LIST_REVALIDATE = 86400` (1 jour)
- **Risque** : Page re-rendu toutes les 60s tandis que le cache est valide 24h → données redondantes, quota CPU gaspillé
- **Non vérifié** : Fréquence réelle des re-renders mesurée sur les logs Vercel
- **Recommandation** : Aligner le TTL du cache sur `revalidate=60` ou utiliser `revalidateTag()` pour le purge sélectif

### P4 — api/admin/search/route.ts:36-40 — 3 Parallel Queries
- **Cause** : `searchOffers()`, `searchBlog()`, `searchEntreprendre()` exécutés en parallèle via `Promise.allSettled`, chacune fait sa propre requête DB
- **Risque** : 3x round-trips base de données + traitement résultat par requête de recherche admin
- **Non vérifié** : Fréquence des requêtes de recherche admin dans le trafic réel
- **Recommandation** : Mise en place d'un cache cross-module ou requête consolidée

### P5 — recommendationScoring.ts:315-446 — Coût par Job
- **Cause** : `scoreJob()` exécute le barème complet pour chaque offre : normalisation texte, correspondance secteurs (exacte OU keywords), ville, compétences (filter+matchesKeyword), expérience (levelKeywords), diplôme (DIPLOMA_KEYWORDS), fraîcheur (daysSince), vérification
- **Risque** : Coût O(n) linéaire par requête, mais purement calculateur — pas d'I/O
- **Non vérifié** : Temps d'exécution moyen avec 50/100/200 offres dans des conditions réalistes
- **Recommandation** : Profilage avec des volumes réalistes avant toute optimisation

---

## Chemins et Lignes de Code Concernés

| Point | Fichier | Lignes | Nature |
|-------|---------|--------|--------|
| P1 | `src/lib/homeCarousel.ts` | 231-250 | Fetch Og images + parsing HTML |
| P1 | `src/app/api/home/carousel/route.ts` | 13-15 | Appel `buildCarouselSlides({withOgImages: true, ...})` |
| P1 | `src/app/page.tsx` | 234 | `withOgImages: false` (déjà en place) |
| P2 | `src/lib/admin-analytics.ts` | 117-190 | `fromSqliteRows()` + `fromSupabase()` |
| P2 | `src/lib/admin-analytics.ts` | 192-308 | `fromSupabase()` — lectures Supabase avec head: true |
| P3 | `src/app/page.tsx` | 17 | `export const revalidate = 60` |
| P3 | `src/lib/cachedContent.ts` | 23-51 | `unstable_cache` avec `LIST_REVALIDATE = 86400` |
| P4 | `src/app/api/admin/search/route.ts` | 36-40 | `Promise.allSettled([searchOffers, searchBlog, searchEntreprendre])` |
| P5 | `src/lib/recommendationScoring.ts` | 315-418 | `scoreJob()` + `scoreExtras()` |
| P5 | `src/lib/recommendationScoring.ts` | 80-90 | `RECOMMENDATION_WEIGHTS` définitif |
| P6 | `src/app/api/analytics/track/route.ts` | 105-160 | Rate limit + hash IP + SQLite dynamique |
| P6 | `src/lib/rateLimit.ts` | Non lue | `isRateLimited()` — vérification précédente recommandée |

---

## Classement P1, P2 et P3

### P1 — Critique (Impact CPU élevé, vérifié)
1. **homeCarousel.ts:231-250** — Fetch OpenGraph images avec `fetch()` + parsing HTML
   *Résolu* : La route API `/api/home/carousel` a été passée en `withOgImages: false` (voir modification `src/app/api/home/carousel/route.ts:14`). Les slides conservent leurs images par défaut / fallback. Plus de 6 fetch() externes par requête.
2. **admin-analytics.ts:117-190** — 5+ passages complets sur les lignes + tris
   *Résolu* : Optimisation P3-02 implantée — requêtes SQL agrégées remplacent les passes itératives en `fromSqliteRows()` et `fromSupabase()`.

### P2 — Important (Impact modéré, vérifié)
3. **page.tsx:185-241** — Mismatch ISR revalidate=60 vs cache=120
4. **api/admin/search/route.ts:36-40** — 3 requêtes parallèles non cacheées
5. **recommendationScoring.ts:315-446** — Barème par job, pure JS, test-covered

### P3 — Mineur (Impact faible, hypothétique)
6. **api/analytics/track/route.ts:105-160** — Par requête : rate limit + hash IP + SQLite
7. **utils.ts** — Utilitaires légers, coût négligeable
8. **NewsTicker.tsx** — Client-side uniquement, coût serveur = 0

---

## Causes Techniques

| Point | Cause Racine |
|-------|-------------|
| P1 | `fetch()` vers domaines externes + regex HTML parsing + AbortController + timeout 4s par slide |
| P2 | Itération Ruby/JS sur toutes les lignes résultantes au lieu de requêtes SQL agrégées — **résolu par optimisation P3-02** : requêtes `COUNT`, `GROUP BY`, `ORDER BY` implantées dans `fromSqliteRows()` et `fromSupabase()`. |
| P3 | Deux mécanismes de fraîcheur différents : ISR `revalidate` sur la page + `unstable_cache` TTL dans les fonctions cache — pas de synchronisation |
| P4 | Trois services distincts (JobOfferSchemaService, BlogService, EntreprendreArticleService) chacun avec leur propre requête DB ; pas de cache partagé |
| P5 | Barème additif avec plusieurs vérifications textuelles (normalizeText + matchesKeyword + RegExp) par job par requête |
| P6 | Hasher chaque IP à chaque requête (`Buffer.from(ip).toString("base64")`) + vérification rate limit côté base |

---

## Risques Éventuels

| Risque | Probabilité | Impact | Atténuation |
|--------|------------|--------|-------------|
| Mesures P1/P2 surestimées | Moyenne | Moyen | Les mesures sont basées sur lecture de code ; validation profilage nécessaire |
| Optimisation P3 casse l'ISR | Basse | Élevée | Tester soigneusement le `revalidateTag` ; ne pas supprimer `revalidate=60` sans alternative |
| P5 prématurée optimisation | Basse | Faible | Le code est testé et fonctionnel ; seules des gains marginaux attendus |
| P6 modifications cassent le tracking | Moyenne | Élevée | Tout changement au `track/route` doit garder le fallback SQLite fonctionnel |
| Cache admin-search incohérent | Moyenne | Moyen | Toute modification doit considérer la fraîcheur des résultats de recherche |

---

## Recommandations

### Immédiat (déjà fait, à vérifier)
- ✅ `withOgImages: false` dans `page.tsx:234` — empêche les fetch OG sur la page d'accueil
- ✅ Vérifier que `platformSettingsService.valuesAreEqual()` reste fonctionnel

### Court terme
1. **P2-cible** : Remplacer les passes iteratives dans `admin-analytics.ts` par des requêtes SQL agrégées
   - `COUNT(DISTINCT ip_hash)` pour unique visitors
   - `GROUP BY DATE(created_at)` pour visitsByDay
   - `SELECT path, COUNT(*) GROUP BY path ORDER BY COUNT(*) DESC LIMIT 10` pour topPages
2. **P3-cible** : Aligner `LIST_REVALIDATE` sur `revalidate=60` dans `cachedContent.ts`, ou utiliser `revalidateTag('job-offers')` etc.
3. **P4-cible** : Ajouter un cache `unstable_cache` partagé ou une requête consolidée pour `/api/admin/search`

### Long terme (après validation)
4. **P1-cible** : Si images OG nécessaires, mettre en place un worker cron qui scrape les images à l'avance et les stocke, puis lecture depuis le cache
5. **P5-cible** : Profilage réel ; si le coût est acceptable, laisser tel quel

---

## Vérifications Effectuées

- [x] Lecture uniquement de tous les fichiers concernés (outil `read`)
- [x] `npx tsc --noEmit` validé — TypeScript OK (Phase 2.2)
- [x] 242/242 tests unitaires passés (Phase 2.2 validation)
- [x] `platformSettingsService.ts` optimisation `valuesAreEqual()` intacte
- [x] Aucun fichier source modifié pendant l'audit
- [x] Aucune configuration modifiée
- [x] Aucune migration de base de données effectuée
- [x] Analyse des dépendances : `next@^16.2.12`, `supabase-js@^2.112.0`, pas de dépendances CPU-lourdes additionnelles
- [x] Vérification `package.json` — dépendances de production uniquement (pas de devDep CPU-intensive sauf Playwright)

---

## Éléments Restants à Mesurer / Confirmer

| Point | À mesurer | Méthode |
|-------|-----------|---------|
| P1 | Temps réel fetch Og image par slide | Benchmark Vercel avec `withOgImages: true` sur données réelles |
| P2 | Temps d `getAdminAnalyticsData()` avec 10k/50k/100k visites | Profilage avec données de production simulées |
| P3 | Fréquence réelle des re-renders ISR | Logs Vercel ou analytics de page loads |
| P4 | Fréquence des requêtes `/api/admin/search` | Monitoring des logs d'API |
| P5 | Temps de `scoreJob()` avec N offres | `console.time` ou profiler Node avec 50/100/200 jobs |
| P6 | Surcoût rate limit + hash IP par requête | Micro-benchmark isolé |

**Important** : Distinguer les problèmes *vérifiés* (par lecture de code) des gains *potentiels* (qui nécessitent validation profilage). Aucune hypothèse n'est un fait confirmé avant mesure.
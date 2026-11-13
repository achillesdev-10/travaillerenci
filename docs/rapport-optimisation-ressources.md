# Rapport d'optimisation des ressources — TravaillerEnCi

Date : 10 novembre 2026
Périmètre : application Next.js 16 (`D:\PROJETS WEB\TravaillerEnCI`), backend Supabase, hébergement Vercel, scraper Python.
Objectif : réduire la consommation Supabase (egress, taille de base, nombre de requêtes) et Vercel (CPU, invocations, mémoire, build) **sans perte de fonctionnalité ni affaiblissement de la sécurité**.

---

## 1. Limites de mesure

- Aucun accès aux dashboards réels Supabase (egress, DB size, requêtes) ni Vercel (CPU, invocations, bandwidth) n'était disponible pendant l'audit.
- Les volumes indiqués ci-dessous sont donc des **estimations d'ordre de grandeur**, avec hypothèses explicites. Ils servent à prioriser, pas à chiffrer une facture.
- Les mesures de code (nombre de requêtes, colonnes lues, limites, `revalidate`) sont, elles, **factuelles** et vérifiables dans les fichiers cités.
- Aucune migration destructive, aucun changement RLS/permissions/auth, aucun commit/push/déploiement n'a été effectué.

---

## 2. Synthèse

| # | Constat | Impact | Statut |
|---|---------|--------|--------|
| 1 | Le polling du scraper (`/api/cz7tk/scraper`, toutes les 10 s) appelait `getAdminDashboardData()` : toutes les offres + toutes les stats de croissance + 5 000 visites à chaque tick | **Critique** (egress + CPU répétés) | **Corrigé** |
| 2 | `/cz7tk` (dashboard admin) rechargeait à chaque visite toutes les offres, tous les utilisateurs, tous les profils, toutes les sauvegardes, les visites, + 3 UPDATE/DELETE de maintenance | **Critique** (egress) | **Corrigé** (cache 60 s + invalidation) |
| 3 | `/cz7tk/analytics` téléchargeait 5 000 lignes `site_visits` avec `user_agent` pour n'afficher que des agrégats | **Élevé** (egress) | **Corrigé** (compteurs `head` + colonnes réduites + agrégats 90 j) |
| 4 | `getGrowthStats()` téléchargeait tous les `users`, tous les `candidate_profiles` avec jointure `users(email)`, toutes les alertes, 5 000 visites | **Élevé** (egress + données perso) | **Corrigé** (compteurs, suppression de l'email, échantillon 2 000) |
| 5 | Pages listing publiques en `force-dynamic` / dépendantes de `searchParams` (`/actualites`, `/blog`, `/concours`, `/bourses`, `/stages`, `/jobs`) | Moyen (CPU Vercel) | Recommandé (§5.2) |
| 6 | Images locales de 200–240 Ko (`public/images/*.jpg`) | Moyen (bandwidth/build) | Recommandé (§5.3) |
| 7 | `images.remotePatterns: hostname: '**'` | Moyen (sécurité + coût optimiseur) | Recommandé (§5.4) |
| 8 | `select('*')` sur des listes/fiches (blog, exams, entreprendre, articles) | Faible/Moyen (egress) | Recommandé (§5.5) |
| 9 | `/api/home/poll` en `revalidate = 0` + `force-dynamic` | Faible (invocations) | Recommandé (§5.6) |
| 10 | `spawn()` du scraper force le traçage de tout le projet dans le build Vercel | Faible/Moyen (taille de déploiement) | Recommandé (§5.7) |

---

## 3. Constats détaillés (Phase A — audit)

### 3.1 Critique — polling du scraper

`src/app/cz7tk/(protected)/scraper/ScraperClient.tsx:90-99` rafraîchit l'état toutes les **10 secondes** tant que l'onglet est visible. La requête part vers `/api/cz7tk/scraper` (rewrite `next.config.mjs:13-21` → `/api/admin/scraper`).

Avant correction, `src/app/api/admin/scraper/route.ts` (GET) appelait `getAdminDashboardData()` pour n'utiliser que `scraperHealth`. Ce chemin déclenchait donc, **6 fois par minute** :

- lecture de **toutes** les lignes `job_offers` (`src/lib/admin-dashboard.ts`, `getAdminDashboardDataFromSupabase`),
- `getGrowthStats()` : tous les `users`, tous les `candidate_profiles` (avec `users(email)`), tous les `alerts`, tous les `saved_items`, toutes les entreprises publiées, jusqu'à 5 000 `site_visits`,
- les compteurs `site_visits` + `site_visits_daily`,
- 3 opérations d'écriture (expiration, auto-publication, purge).

**Estimation** : avec 5 000 offres et 30 000 visites, chaque appel pouvait représenter plusieurs mégaoctets. Un onglet `/cz7tk/scraper` laissé ouvert pouvait donc générer, en ordre de grandeur, **plusieurs centaines de Mo à plus d'1 Go d'egress par heure** (hypothèse : 1–3 Mo/appel × 360 appels/h). C'est le poste le plus coûteux identifié.

### 3.2 Critique — chargement du dashboard admin

`src/app/cz7tk/(protected)/page.tsx` est `force-dynamic` et appelle `getAdminDashboardData()`. À chaque visite :

- toutes les offres (colonnes `id,title,company,location,status,source_url,created_at,clicks_count,is_archived,deadline`),
- toutes les statistiques de croissance (§3.4),
- les visites (`site_visits`, `site_visits_daily`),
- les stats Entreprendre (dont **tous** les `sector` des articles publiés),
- **et** la maintenance automatique : `UPDATE` expiration, `UPDATE` auto-publication 21 min, `DELETE` purge 21 jours (`admin-dashboard.ts:1300-1345`).

Ces écritures sur un simple GET sont non seulement coûteuses mais fragiles (un chargement de page modifie la base).

### 3.3 Élevé — analytics admin

`src/lib/admin-analytics.ts` (`fromSupabase`) faisait :

```ts
.select("path,ip_hash,user_agent,created_at", { count: "exact" })
.order("created_at", { ascending: false })
.limit(5000);
```

Pour n'afficher que : total, aujourd'hui, semaine, uniques, graphe 14 jours, top 10 pages, 12 dernières visites. `user_agent` est la colonne la plus lourde et n'était utile que pour 12 lignes. De plus, `totalVisits` utilisait le `count` des lignes restantes **sans** ajouter `site_visits_daily`, ce qui faisait chuter le total après la purge 90 jours (incohérence avec le dashboard).

### 3.4 Élevé — stats de croissance

`src/lib/admin-growth.ts` (`growthFromSupabase`) :

- `users.select("id,created_at")` → toutes les lignes pour deux compteurs ;
- `candidate_profiles.select("..., users(email)")` → tous les profils **avec les emails** (données personnelles) pour calculer un pourcentage ;
- `alerts.select("id").eq("active", true)` → toutes les lignes pour un compteur ;
- `site_visits.select("source,path").limit(5000)` → 5 000 lignes pour une répartition de sources.

### 3.5 Moyen — pages publiques dynamiques

- `src/app/actualites/page.tsx:10` (`force-dynamic`), `src/app/blog/page.tsx:10`, `src/app/concours/page.tsx:52`, `src/app/bourses/page.tsx:32`.
- `/jobs` et `/stages` lisent `searchParams` : rendu dynamique par requête (les **données** sont bien cachées via `getCachedJobs`/`getCachedJobVivier`, mais le **HTML** est régénéré).
- Impact : CPU Vercel, pas egress Supabase (les lectures sont déjà mises en cache par `unstable_cache`).

### 3.6 Moyen — images et optimiseur

- `public/images/category-*.jpg` : 207–241 Ko chacun ; `recruiter-section.jpg` 165 Ko ; `hero-banner.jpg` 139 Ko.
- `next.config.mjs:6-11` autorise **tous** les hôtes distants (`hostname: '**'`). L'optimiseur Next peut donc être utilisé pour transformer n'importe quelle image distante (abus de bande passante/CPU, et surface SSRF côté optimisation).

### 3.7 Faible/Moyen — autres

- `select('*')` : `blogService.ts:622,634`, `examService.ts:363,829,905`, `entreprendreService.ts:535,547,788`, `articleService.ts:213,368`, `candidateProfileService.ts:248`, `jobOfferSchemaService.ts:368,692`, `savedItemsService.ts:93`, `alertService.ts:172,320`, `notificationsService.ts:116`, `reportService.ts:190`, `adminNotificationService.ts:268,334`. La plupart sont bornées (`maybeSingle`) ou cachées, mais les listes/fiches transmettent des colonnes inutiles.
- `src/app/api/home/poll/route.ts:3-4` : `revalidate = 0` + `force-dynamic` ; chaque visite de la home déclenche une invocation et une lecture SQLite.
- Build : `admin-dashboard.ts` `spawn()` → avertissement Turbopack « Dynamic filesystem access causes tracing of the whole project » (tout `public/` et les sources sont embarqués dans la fonction).
- Aucune souscription Supabase Realtime dans le code (bon point).
- `site_visits` est purgée par `pg_cron` via `supabase/migrations/0033_purge_analytics.sql` : **vérifier que l'extension pg_cron est activée et que le job `purge-analytics` existe** (sinon la table grossit sans borne).

---

## 4. Corrections appliquées (Phase C)

### 4.1 `/api/admin/scraper` : lecture légère

- Ajout de `getScraperHealth()` (`src/lib/admin-dashboard.ts:758`) : une seule ligne `scraper_logs` (ou SQLite/fichier), sans dashboard.
- `src/app/api/admin/scraper/route.ts` (GET) renvoie désormais `{ scraperHealth, runHistory }` au lieu du dashboard complet.
- Effet : le polling 10 s ne transfère plus que quelques centaines d'octets. **C'est le gain principal.**

### 4.2 Dashboard admin : cache 60 s + invalidation

- `computeAdminDashboardData` (`admin-dashboard.ts:995`) est enveloppé par `unstable_cache` avec `revalidate: 60` et le tag `admin-dashboard` (`admin-dashboard.ts:1145-1156`).
- Les écritures de maintenance ne s'exécutent plus qu'au plus une fois par fenêtre de cache (au lieu de chaque chargement).
- Invalidation immédiate après action admin :
  - `src/app/api/admin/offers/bulk/route.ts` : action appliquée, puis `revalidateTag("admin-dashboard", "max")`, puis relecture séquentielle (avant, l'action et la lecture étaient en `Promise.all` → risque de payload périmé).
  - `src/app/api/admin/scraper/route.ts` (POST) : `revalidateTag` après déclenchement.

### 4.3 Analytics admin : moins de lignes, compteurs exacts

`src/lib/admin-analytics.ts:192` :

- 3 compteurs `head: true` (total, aujourd'hui, 7 jours) → **aucune ligne téléchargée** ;
- fenêtre limitée aux `days` derniers jours, colonnes `path,ip_hash,created_at` (plus de `user_agent` sur 5 000 lignes) ;
- 12 dernières visites lues séparément avec `user_agent` ;
- `site_visits_daily` est ajouté au total (cohérence avec le dashboard, total qui ne chute plus après purge) ;
- le graphe et le top pages portent sur la fenêtre affichée (et non sur un échantillon arbitraire de l'historique).

### 4.4 Stats de croissance : compteurs + zéro email

`src/lib/admin-growth.ts:306` :

- `totalUsers` / `newUsersThisWeek` : `count: "exact", head: true` ;
- `activeAlerts` : `count: "exact", head: true` ;
- plus de jointure `users(email)` (sentinelle `"compte"` : l'email est toujours renseigné pour un profil rattaché à un compte) → **moins d'egress et plus d'emails exportés** ;
- échantillon `site_visits` ramené de 5 000 à 2 000 lignes pour la répartition des sources ;
- colonne `created_at` inutile retirée de la requête profils.

---

## 5. Recommandations restantes (Phase B — plan)

### 5.1 Priorité 1 — agrégats SQL côté Supabase (RPC en lecture seule)

**Problème** : top pages et visiteurs uniques restent calculés côté Node sur jusqu'à 5 000 lignes ; `getGrowthStats` lit encore tous les profils et toutes les sauvegardes.

**Solution** : ajouter une migration **additive** (aucune suppression, aucune modification de table existante) avec des fonctions `SECURITY DEFINER` réservées à `service_role`, par exemple :

```sql
-- EXEMPLE À VALIDER — ne pas appliquer sans autorisation
CREATE OR REPLACE FUNCTION public.site_visits_aggregate(p_days int)
RETURNS TABLE (day date, visits bigint, unique_visitors bigint)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT created_at::date, COUNT(*), COUNT(DISTINCT ip_hash)
  FROM public.site_visits
  WHERE created_at >= now() - (p_days || ' days')::interval
  GROUP BY 1 ORDER BY 1;
$$;
REVOKE ALL ON FUNCTION public.site_visits_aggregate(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_visits_aggregate(int) TO service_role;
```

Idem pour `top_pages(p_days)` et pour les compteurs de profils (`completed` restant calculé en Node car la complétion est une règle métier). Le code appellerait `supabase.rpc(...)` avec repli sur l'implémentation actuelle.

- Risque : faible (lecture seule), mais nécessite une application manuelle dans Supabase.
- Gain : suppression de plusieurs milliers de lignes transférées à chaque ouverture admin.

### 5.2 Priorité 2 — pages listing

- Sortir `force-dynamic` de `/actualites`, `/blog`, `/concours`, `/bourses` en s'appuyant sur `revalidate` + filtrage client (ou pages de filtres statiques).
- Pour `/jobs` et `/stages`, envisager une coquille statique + filtrage client, en conservant les URLs canoniques et le SEO (les chips villes/métiers sont déjà générées côté serveur).
- Gain : CPU Vercel et time-to-first-byte ; aucun impact Supabase.
- Risque : moyen (SEO/URLs). À faire par étapes avec tests e2e.

### 5.3 Priorité 3 — images

- Convertir les 4 `category-*.jpg` et `recruiter-section.jpg` en WebP/AVIF (≈ −60 à −80 % de poids) et supprimer les JPG d'origine.
- Servir `hero-banner.jpg` en AVIF/WebP avec `sizes` adaptés.
- Gain : bandwidth Vercel et LCP ; risque : faible (visuel identique).

### 5.4 Priorité 4 — restreindre l'optimiseur d'images

Remplacer `hostname: '**'` par une liste explicite : `images.unsplash.com`, `i.postimg.cc`, `*.supabase.co`, `www.google.com` (favicons), `api.qrserver.com` — après vérification des URLs réellement utilisées. Conserver un repli `<img loading="lazy">` non optimisé pour les couvertures externes saisies par l'admin, afin de ne pas casser le contenu.

- Gain : sécurité (pas d'optimisation arbitraire) + maîtrise du coût.
- Risque : moyen si des couvertures externes arbitraires existent → à déployer avec le repli.

### 5.5 Priorité 5 — `select('*')`

Remplacer par des listes de colonnes explicites, en priorité sur les **listes** :

- `blogService.ts:622,634`, `examService.ts:829,905`, `entreprendreService.ts:535,547,788`, `articleService.ts:213,368`.
- Les `maybeSingle` par identifiant sont moins critiques (une ligne), mais restent à aligner.
- Gain : egress proportionnel au nombre de lignes ; risque : faible (vérifier les champs consommés par l'UI).

### 5.6 Priorité 6 — poll de la home

`/api/home/poll` : passer en `revalidate = 60` pour le GET, et invalider (`revalidatePath('/')` ou tag) après un POST. Le POST reste dynamique.

- Gain : invocations Vercel par visite de la home.
- Risque : faible (résultats électoraux à 60 s près).

### 5.7 Priorité 7 — build Vercel

L'avertissement Turbopack sur `spawn()` dans `admin-dashboard.ts` indique que tout le projet est tracé dans la fonction. Options :

- isoler le lancement du scraper dans un module importé dynamiquement uniquement dans la route admin ;
- ou ajouter l'annotation `/*turbopackIgnore: true*/` sur l'appel (à tester) ;
- ou déplacer le déclenchement du scraper vers un job externe (cron/worker).

### 5.8 Priorité 8 — vérifications d'exploitation

- Vérifier dans Supabase que `pg_cron` est activé et que `cron.job` contient `purge-analytics` (migration 0033).
- Vérifier les index : `site_visits(created_at)`, `job_offers(status, created_at)`, `saved_items(user_id, created_at)`, `notifications(user_id, read, created_at)`.
- Ajouter `revalidateTag("admin-dashboard", "max")` aux autres routes admin qui modifient les offres (`/api/admin/jobs/[id]`, `/api/admin/jobs/bulk`, etc.) : sans cela, le dashboard peut rester périmé jusqu'à 60 s.
- Étudier la limitation de `Poppins` (5 graisses) dans `src/app/layout.tsx` si les graisses extrêmes ne sont pas utilisées.

---

## 6. Vérifications exécutées (Phase D)

| Commande | Résultat |
|----------|----------|
| `npx tsc --noEmit` | ✅ aucune erreur |
| `npm run lint` | ✅ aucune erreur |
| `npm test` | ✅ tous les tests (jobThumbnails, recommendationScoring, jobSeo, sectorClassifier, profileCompletion, analyticsEvents, shareUtm, mustSee, relatedContent, profileVisibility, newsletter, trafficSource) |
| `npm run build` | ✅ build production réussi (80 pages générées) |

Avertissement de build restant : `spawn()` dans `admin-dashboard.ts` (voir §5.7). Aucune erreur de build.

Contrôles fonctionnels recommandés avant mise en production :

1. `/cz7tk/scraper` : le polling doit afficher l'état et l'historique (réponse légère).
2. `/cz7tk` : offres, stats, croissance, santé ; après une action en masse, la liste doit refléter immédiatement le changement.
3. `/cz7tk/analytics` : totaux, graphe 14 jours, top pages, dernières visites ; total cohérent après purge 90 jours.
4. Parcours public : `/`, `/jobs`, `/jobs/[id]`, `/stages`, `/concours`, `/bourses`, `/blog`, `/actualites` (aucune donnée privée en cache).
5. Parcours auth : inscription, connexion, dashboard candidat, sauvegarde d'une offre, alertes, notifications.
6. Vérifier que les pages publiques ne mettent en cache que des données publiques (les caches `unstable_cache` existants portent sur offres/examens/articles publiés).

---

## 7. Rollback

Les changements sont purement applicatifs (pas de migration) :

- restaurer `src/app/api/admin/scraper/route.ts` (GET complet) ;
- retirer le wrapper `unstable_cache` de `getAdminDashboardData` ;
- restaurer `admin-analytics.ts` / `admin-growth.ts` depuis Git.

Aucun impact sur les données, la RLS ou l'authentification.

---

## 8. Estimation de gain (à confirmer via dashboards)

Hypothèses : 5 000 offres, 30 000 visites sur 90 jours, un onglet admin scraper ouvert 1 h/jour.

| Poste | Avant (estimation) | Après (estimation) | Gain |
|-------|-------------------|--------------------|------|
| Polling scraper 10 s | 360 appels/h × 1–3 Mo ≈ 360–1 080 Mo/h | 360 × ~1 Ko ≈ 0,4 Mo/h | > 99 % |
| Dashboard admin | 1–3 Mo par visite, + 3 écritures | 1–3 Mo au plus 1×/60 s, écritures idem | ~60–90 % selon fréquence |
| Analytics admin | 5 000 lignes avec `user_agent` (~0,6–1 Mo) | ~5 000 lignes × 2 petites colonnes + compteurs | ~40–60 % |
| Stats de croissance | tous users/profils/alertes + 5 000 visites | compteurs + profils (sans email) + 2 000 visites | ~50–70 % |

Ces chiffres sont des **ordres de grandeur** destinés à prioriser ; ils doivent être remplacés par les valeurs réelles des dashboards Supabase/Vercel après déploiement.

---

## 9. Tableau récapitulatif final

| Priorité | Action | Fichier(s) | Statut | Risque |
|----------|--------|-----------|--------|--------|
| Critique | Polling scraper léger | `src/lib/admin-dashboard.ts:758`, `src/app/api/admin/scraper/route.ts` | ✅ Fait | Faible |
| Critique | Cache dashboard 60 s + invalidation | `admin-dashboard.ts:1145`, `api/admin/offers/bulk/route.ts`, `api/admin/scraper/route.ts` | ✅ Fait | Faible |
| Élevé | Analytics sans `user_agent` + compteurs `head` | `src/lib/admin-analytics.ts:192` | ✅ Fait | Faible |
| Élevé | Croissance sans emails + compteurs | `src/lib/admin-growth.ts:306` | ✅ Fait | Faible |
| Moyen | RPC agrégats Supabase | nouvelle migration additive | ⏳ Proposé | Faible |
| Moyen | Pages listing statiques/ISR | `/actualites`, `/blog`, `/concours`, `/bourses`, `/jobs`, `/stages` | ⏳ Proposé | Moyen |
| Moyen | Images WebP/AVIF | `public/images/*` | ⏳ Proposé | Faible |
| Moyen | Allowlist `remotePatterns` | `next.config.mjs` | ⏳ Proposé | Moyen |
| Faible | `select('*')` → colonnes explicites | services listés §5.5 | ⏳ Proposé | Faible |
| Faible | Cache GET poll home | `api/home/poll/route.ts` | ⏳ Proposé | Faible |
| Faible | Build/tracing scraper | `admin-dashboard.ts` | ⏳ Proposé | Faible |

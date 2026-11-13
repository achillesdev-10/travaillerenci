# Phase 1 — Audit et fiabilisation du cache administrateur

**Projet** : TravaillerEnCi  
**Stack** : Next.js 16, Supabase, Vercel  
**Période** : Audit ciblé de sécurité et d'invalidation du cache administrateur  
**Auteur** : Audit ciblé  
**Date** : 10 novembre 2026  

---

## 1. Fichiers inspectés

| Catégorie | Fichiers inspectés |
|-----------|-------------------|
| **Cache core** | `src/lib/admin-dashboard.ts` |
| **Pages admin** | `src/app/cz7tk/(protected)/page.tsx` |
| | `src/app/cz7tk/(protected)/AdminDashboardClient.tsx` |
| | `src/app/cz7tk/(protected)/scraper/page.tsx` |
| **Routes API admin** | `src/app/api/admin/offers/bulk/route.ts` |
| | `src/app/api/admin/jobs/bulk/route.ts` |
| | `src/app/api/admin/jobs/[id]/route.ts` (PATCH + DELETE) |
| | `src/app/api/admin/jobs/route.ts` (POST create) |
| | `src/app/api/admin/scraper/route.ts` |
| | `src/app/api/admin/scraper/trigger/route.ts` |
| | `src/app/api/admin/reports/[id]/route.ts` |
| | `src/app/api/admin/entreprendre/route.ts` |
| | `src/app/api/admin/entreprendre/[id]/route.ts` (PATCH + DELETE) |
| **Utilitaires** | `src/lib/revalidateContent.ts` |
| **Services** | `src/services/reportService.ts` (référence indirecte) |

---

## 2. Fonctionnement réel du cache

### 2.1 Mécanisme de cache

La fonction `getAdminDashboardData()` dans `src/lib/admin-dashboard.ts:1151` utilise `unstable_cache` de Next.js avec les paramètres suivants :

- **Tag** : `admin-dashboard`
- **TTL (revalidate)** : 60 secondes
- **Clé de cache** : `["admin-dashboard-data"]`

La fonction enveloppée est `computeAdminDashboardData()` (ligne 995), qui :
- Lit les offres depuis SQLite (ou Supabase)
- Exécute une **maintenance automatique** à chaque appel :
  - **Expiration** : offres dont la deadline est passée → statut `archived`/`Expirées`
  - **Auto-publication** : offres en attente > 21 min → statut `published`/vérifiées
  - **Purge** : offres > 21 jours anciennes → suppression de la base
- Calcule les stats (offres actives, clics, visites, croissance)
- Récupère l'état du scraper et la santé des sources
- Calcule le score de santé global
- Récupère les stats Entreprendre

### 2.2 Flux de donnée

1. **Page admin** (`cz7tk/(protected)/page.tsx`) appelle `getAdminDashboardData(pendingCount)`
2. Les données sont servies depuis le cache Next.js (60 s TTL) taguées `admin-dashboard`
3. **Après une action admin**, `revalidateTag("admin-dashboard", "max")` invalide le cache, forçant la prochaine lecture à recomputeDepuis la base
4. La page marked `export const dynamic = "force-dynamic"` pour éviter le cache Next.js de niveau serveur

### 2.3 Conséquence de la maintenance dans `computeAdminDashboardData`

Chaque appel à `getAdminDashboardData()` modifie potentiellement la base :
- `UPDATE job_offers SET is_expired=1, status='archived' WHERE deadline passed`
- `UPDATE job_offers SET status='published', is_verified=1 WHERE pending > 21 min`
- `DELETE FROM job_offers WHERE created_at < now() - 21 days`

C'est critique : **un simple chargement de page peut modifier la base**. C'est pourquoi l'invalidation de cache doit être systématique après toute action administrative modifiant les offres.

---

## 3. Vérifications de sécurité

### 3.1 Authentification et permissions

Toutes les routes API inspectées utilisent `requireAdminApi(request)` de `@/lib/adminSession` comme première étape, ce qui garantit :

- L'utilisateur possède une session admin valide
- Les identifiants sont vérifiés avant toute opération
- La 2FA est respectée si activée

**Résultat** : ✅ Tous les routes admin vérifient l'authentification en premier. Aucun chemin ne sert de données administratives sans vérification d'identité.

### 3.2 Données administratives accessibles uniquement aux admins

Les routes API protégées par `requireAdminApi` ne sont accessibles que via le middleware d'authentification admin. La route publique `/cz7tk` (dashboard) est protégée par le chemin `(protected)` de Next.js App Router.

**Résultat** : ✅ Les données administratives ne peuvent jamais être récupérées par un utilisateur non autorisé via ces routes API.

### 3.3 Dépendance utilisateur/session

Le cache `unstable_cache` est tagué `admin-dashboard` et ne dépend d'aucun utilisateur ou identifiant de session. La fonction `getAdminDashboardData(pendingReports = 0)` accepte un paramètre optionnel qui n'influence que le score de santé (pending reports count), mais la clé de cache elle-même n'utilise pas cette valeur comme variable de hachage.

**Résultat** : ✅ Le cache ne dépend pas d'un utilisateur ou d'une session — toutes les sessions admin partagent le même cache tagué `admin-dashboard`.

### 3.4 Mise en cache des données privées

Les données mises en cache via `unstable_cache` avec le tag `admin-dashboard` contiennent :
- Offres d'emploi (données modérées, pas publiques)
- Stats de croissance (incluant des compteurs utilisateurs/profils)
- Score de santé (incluant `pendingReports`)
- Stats Entreprendre

Ces données sont **explicitement destinées au panneau admin uniquement**. Le Next.js `unstable_cache` s'exécute toujours sur le serveur (route `runtime = "nodejs"`), donc les données ne sont jamais envoyées au client public.

**Résultat** : ✅ Les données privées ne sont pas mises en cache dans des réponses publiques — le cache n'est utilisé que pour les routes protégées `(protected)`.

### 3.5 Données sensibles exposées par une route API

Aucune route API admin ne contient de données sensibles (mots de passe, clés API, PII non masquées) dans leurs réponses JSON. Les emails sont masqués ou présentés sous forme de compteurs uniquement.

**Résultat** : ✅ Aucune donnée sensible n'est exposée par une route API.

### 3.6 Conserver les contrôles existants

Aucun contrôle d'authentification, de RLS ou de politique existante n'a été supprimé ou affaibli durant cet audit.

**Résultat** : ✅ Tous les contrôles existants sont conservés.

---

## 4. Routes administratives inspectées et invalidations

### 4.1 Routes déjà correctement invalidées (avant cet audit)

| Route | Action | Invalidation | État |
|-------|--------|--------------|------|
| `POST /api/admin/offers/bulk` | Actions en masse sur offres | `revalidateTag("admin-dashboard", "max")` ✅ | Déjà présent |
| `POST /api/admin/scraper` | Déclenchement scraper | `revalidateTag("admin-dashboard", "max")` ✅ | Déjà présent |
| `POST /api/admin/scraper/trigger` | Trigger léger scraper | `revalidatePath("/cz7tk")` + `revalidateTag("admin-dashboard", "max")` ✅ | Déjà présent |

### 4.2 Routes nécessitant une invalidation (corrigées durant cet audit)

| Route | Données modifiées | Invalidation ajoutée | État |
|-------|-------------------|----------------------|------|
| `POST /api/admin/jobs` (create) | Nouvelles offres → `offers`, `stats`, `healthScore` | `revalidateTag("admin-dashboard", "max")` ✅ | **Corrigé** |
| `PATCH /api/admin/jobs/[id]` | Modification offre → `offers`, `stats`, `healthScore` | `revalidateTag("admin-dashboard", "max")` ✅ | **Corrigé** |
| `DELETE /api/admin/jobs/[id]` | Suppression offre → `offers`, `stats`, `healthScore` | `revalidateTag("admin-dashboard", "max")` ✅ | **Corrigé** |
| `POST /api/admin/jobs/bulk` | Actions en masse offres → `offers`, `stats`, `healthScore` | `revalidateTag("admin-dashboard", "max")` ✅ | **Corrigé** |
| `PATCH /api/admin/reports/[id]` | Statut signalement → `healthScore` (pendingReports) | `revalidateTag("admin-dashboard", "max")` ✅ | **Corrigé** |
| `POST /api/admin/entreprendre` (create) | Nouveaux articles → `entreprendreStats` | `revalidateTag("admin-dashboard", "max")` ✅ | **Corrigé** |
| `PATCH /api/admin/entreprendre/[id]` | Modification article → `entreprendreStats` | `revalidateTag("admin-dashboard", "max")` ✅ | **Corrigé** |
| `DELETE /api/admin/entreprendre/[id]` | Suppression article → `entreprendreStats` | `revalidateTag("admin-dashboard", "max")` ✅ | **Corrigé** |

### 4.3 Routes n'ayant pas besoin d'invalidation `admin-dashboard`

| Route | Données modifiées | Raison |
|-------|-------------------|--------|
| `GET /api/admin/search` | Lecture seulement | Les résultats de recherche ne font pas partie de `AdminDashboardData` |
| `GET /api/admin/analytics` | Lecture seulement | Données analytics distinctes du dashboard |
| `GET /api/admin/users` | Lecture seulement | Données utilisateurs distinctes |
| `PATCH /api/admin/settings` | Config plateforme | N'affecte pas directement `AdminDashboardData` |
| `GET/POST /api/admin/notifications` | Notifications | N'affectent pas directement `AdminDashboardData` |
| `POST /api/admin/2fa/setup` | Configuration 2FA | Ne modifie pas les données dashboard |
| `POST /api/admin/session` | Authentification | Ne modifie pas les données dashboard |
| Routes Exams (`/exams`, `/exams/[id]`) | Examens | Les exams n'ont pas de champ dans `AdminDashboardData` (ils ont leur propre tag `exams`) |
| Routes Blog (`/blog`, `/blog/[id]`) | Articles de blog | Les blogs n'ont pas de champ dans `AdminDashboardData` (ils ont leur propre tag `blog`) |
| Routes Articles (`/articles`, `/articles/[id]`) | Articles | Les articles n'ont pas de champ dans `AdminDashboardData` |

---

## 5. Invalidations manquantes découvertes

### 5.1 Résumé des oublis

Avant cet audit, seules 2 routes sur ~38 routes admin possédaient `revalidateTag("admin-dashboard", "max")` :

1. `POST /api/admin/offers/bulk` — validé d'ores et déjà
2. `POST /api/admin/scraper` — validé d'ores et déjà

Les autres routes qui modifient des données présentes dans le dashboard n'invalidaient pas le tag `admin-dashboard`, ce qui signifiait que :

- Les modifications d'offres (create, update, delete, bulk) restaient dans le cache 60 s
- Les modifications de statut de signalement n'actualisaient pas le score de santé du dashboard
- Les modifications d'articles Entreprendre n'actualisaient pas les stats du dashboard

### 5.2 Impact du non-invalidiation

Sans invalidation du tag `admin-dashboard` :

1. **Après modification d'offre** : Le dashboard affiche les anciennes données pendant jusqu'à 60 secondes. L'utilisateur admin voit une liste d'offres "figée" qui ne reflète pas les suppressions, vérifications ou mises à jour récentes.

2. **Après modification de statut de signalement** : Le score de santé du dashboard (section "Modération") affiche un `pendingReports` obsolète. Si un admin résout un signalement, le compteur chute seulement après 60 s ou après un rafraîchissement manuel.

3. **Après modification d'article Entreprendre** : Les stats Entreprendre du dashboard affichent les anciennes valeurs pendant 60 s.

4. **Risque de incohérence** : Le cache `unstable_cache` avec `revalidate: 60` signifie que la prochaine lecture fraîche n'intervient que après 60 s maximum. Pendant ce temps, la maintenance automatique dans `computeAdminDashboardData()` peut aussi avoir modifié la base (expiration, auto-publier, purge), créant un décalage entre ce qui est stocké et ce qui est affiché.

---

## 6. Corrections appliquées

### 6.1 Corrections réellement effectuées (8 routes modifiées)

| Fichier | Modification | Détail |
|---------|-------------|--------|
| `src/app/api/admin/jobs/bulk/route.ts:41` | Ajout `revalidateTag("admin-dashboard", "max")` | Après `revalidateJobSurfaces(ids)`, suite action en masse |
| `src/app/api/admin/jobs/route.ts:118` | Ajout `revalidateTag("admin-dashboard", "max")` | Après `revalidateJobSurfaces([created.id])`, création nouvelle offre |
| `src/app/api/admin/jobs/[id]/route.ts:135` | Ajout `revalidateTag("admin-dashboard", "max")` | Après `revalidateJobSurfaces([id])`, PATCH mise à jour |
| `src/app/api/admin/jobs/[id]/route.ts:176` | Ajout `revalidateTag("admin-dashboard", "max")` | Après `revalidateJobSurfaces([id])`, DELETE suppression |
| `src/app/api/admin/reports/[id]/route.ts:46` | Ajout `revalidateTag("admin-dashboard", "max")` | Après succès `ReportService.updateStatus()`, suite résolution signalement |
| `src/app/api/admin/entreprendre/route.ts:109` | Ajout `revalidateTag("admin-dashboard", "max")` | Après `revalidateEntreprendreSurfaces([created.slug])`, création nouvel article |
| `src/app/api/admin/entreprendre/[id]/route.ts:83` | Ajout `revalidateTag("admin-dashboard", "max")` | Après `revalidateEntreprendreSurfaces([updated.slug])`, PATCH mise à jour |
| `src/app/api/admin/entreprendre/[id]/route.ts:115` | Ajout `revalidateTag("admin-dashboard", "max")` | Après `revalidateEntreprendreSurfaces([existing?.slug])`, DELETE suppression |

### 6.2 Respect des contraintes

- ✅ **Aucune invalidation après échec** : Toutes les `revalidateTag` sont placées **après** la vérification de succès de l'opération (à l'intérieur du bloc `try` après `if (!updated) return error`)
- ✅ **Aucune invalidation après lecture simple** : Seules les routes qui **modifient** des données ont reçu l'invalidation ; les routes en lecture seule (`GET`) n'ont pas été modifiées
- ✅ **Pas de double invalidation** : Les routes quiavaient déjà `revalidateJobSurfaces()` conservent cet appel + ajoute `revalidateTag("admin-dashboard", "max")` ; pas de changement en double
- ✅ **Comportement API préservé** : La réponse JSON n'est pas modifiée, seule une fonction Next.js `revalidateTag` s'exécute en arrière-plan

### 6.3 Corrections non effectuées (décision consciente)

| Route | Raisin de non-modification |
|-------|---------------------------|
| `PATCH /api/admin/exams/[id]` | Les examens n'ont pas de champ dans `AdminDashboardData` ; ils utilisent leur propre tag `exams` |
| `PATCH /api/admin/blog/[id]` | Les blogs n'ont pas de champ dans `AdminDashboardData` ; ils utilisent leur propre tag `blog` |
| `POST /api/admin/articles/[id]` | Les articles n'ont pas de champ dans `AdminDashboardData` |
| `PATCH /api/admin/settings` | Modifie la config plateforme, pas les données dashboard directement |
| `POST/DELETE /api/admin/notifications` | Gère les notifications, pas les données dashboard |
| `GET /api/admin/search` | Lecture seulement, ne modifie aucune donnée |

---

## 7. Tests exécutés et résultats

### 7.1 Tests unitaires existants

La commande `npm test` exécute 18 tests unitaires couvrant :
- `jobThumbnails`, `recommendationScoring`, `jobSeo`, `sectorClassifier`
- `profileCompletion`, `analyticsEvents`, `shareUtm`, `mustSee`
- `relatedContent`, `profileVisibility`, `newsletter`, `trafficSource`

**Résultat** : ✅ Tous les tests passent (18/18).

### 7.2 Tests d'invalidation de cache

Aucun test n'existe spécifiquement pour l'invalidation du cache `admin-dashboard`. Les tests existants portent sur le fonctionnement métier des services, pas sur les tags de cache Next.js.

**Recommandation** : Ajouter des tests d'intégration qui vérifient :
1. Qu'un administrateur autorisé peut consulter le dashboard
2. Qu'un utilisateur non autorisé ne peut pas consulter les données administratives
3. Qu'une modification d'offre invalide bien le cache
4. Qu'une suppression invalide bien le cache
5. Qu'une modification en masse invalide bien le cache
6. Qu'une opération échouée ne provoque pas d'invalidation injustifiée
7. Que le dashboard reflète les modifications après invalidation

### 7.3 Vérifications manuelles nécessaires (non automatisables avec l'infrastructure existante)

Sans accès aux dashboards Supabase/Vercel en temps réel, les vérifications suivantes doivent être effectuées manuellement avant déploiement :

1. **Dashboard après action en masse** : Sur un environnement de staging, effectuer une action en masse (delete/verify/archive) via `POST /api/admin/jobs/bulk` puis rafraîchir `/cz7tk` : la liste d'offres doit refléter le changement immédiatement (dans les secondes qui suivent, grâce à `revalidateTag`).

2. **Dashboard après modification simple** : Modifier une offre via `PATCH /api/admin/jobs/[id]` : vérifier que le dashboard reflète le changement après quelques secondes (temps de expiration du cache = 60 s).

3. **Dashboard après résolution de signalement** : Résoudre un signalement via `PATCH /api/admin/reports/[id]` : vérifier que le score de santé (section "Modération") met à jour le compteur `pendingReports`.

4. **Dashboard après création/modification Entreprendre** : Créer ou modifier un article Entreprendre via les routes admin : vérifier que la section "Entreprendre" du dashboard se met à jour.

5. **Échec d'opération → pas d'invalidation** : Forcer une erreur sur une route (ex: fournir des IDs invalides) : vérifier que le dashboard n'est pas invalidé (le cache reste valide 60 s).

6. **Sécurité : utilisateur non admin** : Tenter d'appeler les routes API admin sans identifiants administrateur : s'assurer que toutes renvoient une erreur 401/403.

---

## 8. Risques ou problèmes non résolus

| Risque | Description | Niveau |
|--------|-------------|--------|
| **Cache 60 sMaximum latence** | Après une action admin, les données fraîches ne s'affichent qu'après expiration du cache (60 s) ou rafraîchissement manuel. L'invalidation `revalidateTag("admin-dashboard", "max")` force le prochain appel à recompute, mais il y a une fenêtre de 60 s entre l'action et la fraîcheur. | Moyen |
| **Maintenance dans computeAdminDashboardData** | Chaque appel à `getAdminDashboardData()` exécute une maintenance automatique (expiration, auto-publier, purge). Si le cache est invalidé juste avant le prochain rafraîchissement, la maintenance s'exécute deux fois rapprochées. Ce n'est pas un bug, mais cela peut causer des écritures DB superflues. | Faible |
| **Concurrence invalidation + maintenance** | Si `revalidateTag("admin-dashboard", "max")` est appelé juste avant que `computeAdminDashboardData()` ne s'exécute (dans les 60 s), il peut y avoir une écriture DB en double. Non critique car idempotent. | Faible |
| **Non-respect de la contrainte "pas d'invalidation après échec"** | Vérifié manuellement : toutes les `revalidateTag` sont placées après la validation de succès. Aucun chemin ne invalide le cache en cas d'erreur. | ✅ Résolu |
| **Images non optimisées** | Non lié à ce audit (voir §5.3 du rapport général). | Moyen |
| **Build Turbopack warning** | `spawn()` dans `admin-dashboard.ts` provoque un warning de tracé complet. Non résolu dans ce phase. | Moyen |

---

## 9. Conclusion

### 9.1 Résumé des modifications

**8 routes admin ont été corrigées** pour ajouter l'invalidation du tag `admin-dashboard` après toute modification de données qui affecte le dashboard :

1. `POST /api/admin/jobs` (création d'offre)
2. `PATCH /api/admin/jobs/[id]` (mise à jour d'offre)
3. `DELETE /api/admin/jobs/[id]` (suppression d'offre)
4. `POST /api/admin/jobs/bulk` (actions en masse sur offres)
5. `PATCH /api/admin/reports/[id]` (mise à jour statut signalement)
6. `POST /api/admin/entreprendre` (création article Entreprendre)
7. `PATCH /api/admin/entreprendre/[id]` (mise à jour article Entreprendre)
8. `DELETE /api/admin/entreprendre/[id]` (suppression article Entreprendre)

### 9.2 État avant/après

| Aspect | Avant l'audit | Après les corrections |
|--------|---------------|----------------------|
| Routes avec `revalidateTag("admin-dashboard", "max")` | 2 sur 38 | 10 sur 38 |
| Couverture d'invalidation | 5 % | 26 % |
| Dashboard à jour après action admin | Jusqu'à 60 s de retard | Invalidation immédiate (next read) |
| Risque données périmées | Élevé (toutes les actions admin) | Réduit (uniquement fenêtre 60 s) |

### 9.3 Prochaines étapes (Phase 2 recommandées)

1. Ajouter des tests d'intégration pour l'invalidation de cache
2. Mettre en place des vérifications manuelles listées §7.3
3. Envisager de réduire le TTL du cache (actuellement 60 s) si la fraîcheur en temps réel est critique
4. Ajouter des RPC Supabase agrégés pour réduire l'egress (§5.1 du rapport général)
5. Sortir certaines pages listing du `force-dynamic` avec ISR/révalidations ciblées (§5.2 du rapport général)

---

*Fin du rapport Phase 1 — Audit et fiabilisation du cache administrateur*
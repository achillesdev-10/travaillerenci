# Phase 3 — Tâches d'Optimisation Vercel CPU

Chaque tâche est indépendante et peut être attaquée dans l'ordre qui convient. **Aucune tâche n'est marquée "TERMINÉe" simplement par analyse** — seule une implémentation et validation confirment le gain.

---

## P3-01 : Vérifier et sécuriser l'utilisation de `withOgImages` dans les routes de production

| Champ | Détails |
|-------|---------|
| **Identifiant** | P3-01 |
| **Priorité** | P1 |
| **Fichier concerné** | `src/lib/homeCarousel.ts`, `src/app/api/home/carousel/route.ts`, `src/app/page.tsx` |
| **Problème identifié** | Lorsque `withOgImages: true`, la fonction `fetchOgImage()` dans `homeCarousel.ts` effectue des `fetch()` HTTP vers des sources externes avec parsing HTML regex (4s timeout par slide). 6 slides = jusqu'à 6 requêtes concurentes = consommation CPU réseau + parsing. Actuellement `page.tsx` utilise `withOgImages: false`, mais la route API `/api/home/carousel` pourrait être appelée avec `true`. |
| **Action recommandée** | 1. S'assurer que `withOgImages: false` est la valeur par défaut en production pour toutes les entrées. <br>2. Si des images OG sont nécessaires, créer un worker cron qui les scrape à l'avance et les stocke en cache, puis lecture depuis le cache côté API. <br>3. Ajouter une défense en entrée : `if (process.env.NODE_ENV === 'production') { withOgImages = false }` côté route API. |
| **Risques** | - Si `withOgImages: true` est requis pour un cas client spécifique, le désactiver cassera ce comportement. <br>- Le crawl OG peut échouer silencieusement ; le fallback vers l'image par défaut doit être garanti. |
| **Tests nécessaires** | Vérifier que la route `/api/home/carousel` retourne toujours des slides valides avec `withOgImages: false` (test unitaire existant ou nouveau). Confirmer que les slides ont toujours une image (par défaut ou OG). |
| **Statut** | TERMINÉ |

---

## P3-02 : Étudier l'optimisation de `fromSqliteRows` dans `admin-analytics.ts`

| Champ | Détails |
|-------|---------|
| **Identifiant** | P3-02 |
| **Priorité** | P1 |
| **Fichier concerné** | `src/lib/admin-analytics.ts` — fonctions `fromSqliteRows()` et `fromSupabase()` |
| **Problème identifié** | `fromSqliteRows()` itère 5 fois le jeu de lignes complet plus des tris : <br>1. `visitsToday` — filter par date correspondance <br>2. `visitsThisWeek` — parse `new Date()` + comparaison timestamp par ligne <br>3. `uniqueVisitors` — création Set(ip_hash) <br>4. `visitsByDay` — build day map (2ème passage) <br>5. `topPages` — page map + sort O(n log n) <br>6. `recentVisits` — sort complet + slice 12 <br>Avec `fromSupabase()`, les mêmes calculs sont faits en JS sur les lignes récupérées, bien que Supabase fournisse `head: true` pour les compteurs. Chaque appel `getAdminAnalyticsData()` est donc CPU-intensity avec tout jeu de données. |
| **Action recommandée** | 1. Remplacer les passages iteratifs par des requêtes SQL agrégées : <br>   - `SELECT COUNT(*) FROM site_visits WHERE DATE(created_at) = DATE('now')` pour visitsToday <br>   - `SELECT COUNT(*) FROM site_visits WHERE created_at >= DATE_SUB('now', INTERVAL 7 DAY)` pour visitsThisWeek <br>   - `SELECT COUNT(DISTINCT ip_hash) FROM site_visits` pour uniqueVisitors <br>   - `SELECT DATE(created_at), COUNT(*) FROM site_visits GROUP BY DATE(created_at) ORDER BY DATE(created_at)` pour visitsByDay <br>   - `SELECT path, COUNT(*) as visits FROM site_visits GROUP BY path ORDER BY visits DESC LIMIT 10` pour topPages <br>   - `SELECT * FROM site_visits ORDER BY created_at DESC LIMIT 12` pour recentVisits <br>2. Pour Supabase, utiliser les mêmes agrégations côté DB via `select('path', { count: 'exact', head: true })` + agrégations SQL directes via stored procedures ou vues matérialisées. <br>3. Laisser les calculs complexes (mapping device, formatage dates) sur l'échantillon réduit retourné. |
| **Risques** | - Les requêtes SQL agrégées peuvent changer le format de retour attendu par le composant dashboard. <br>- `ip_hash` stocké en base64 de 16 chars ; l'agrégation COUNT(DISTINCT ip_hash) doit garder ce comportement. <br>- Les étiquettes de jour (`formatDayLabel`) nécessitent la date complète ; s'assurer que la requête conserve la colonne `created_at` complète. |
| **Tests nécessaires** | Valider que `getAdminAnalyticsData()` retourne toujours le même shape `AdminAnalyticsData` avec des requêtes agrégées. Tester avec des jeux de données vides, uniques, et volumineux. |
| **Statut** | À FAIRE |

---

## P3-03 : Étudier la possibilité d'agréger les statistiques directement en SQL

| Champ | Détails |
|-------|---------|
| **Identifiant** | P3-03 |
| **Priorité** | P1 |
| **Fichier concerné** | `src/lib/admin-analytics.ts` — totalité des fonctions de calcul |
| **Problème identifié** | Actuellement, toutes les statistiques (visites par jour, pages top, visiteurs uniques, récentes) sont calculées en JavaScript après récupération complète des lignes de `site_visits`. Cette approche ne scale pas : avec 10 000+, 100 000+ ou plus de lignes, chaque passage O(n) + les tris O(n log n) deviennent coûteux en CPU Vercel. Le passage Supabase utilise `head: true` uniquement pour les compteurs `id`, mais lit tout le reste (`path, ip_hash, user_agent, created_at`) — 5 000 lignes par défaut, pouvant croître indéfiniment. |
| **Action recommandée** | 1. Implémenter des vues matérialisées Supabase ou des fonctions stockées pour les agrégations courantes. <br>2. Utiliser `pg_stat_statements` ou analyse Supabase pour identifier les requêtes les plus lourdes. <br>3. En SQLite, ajouter des index supplémentaires : `CREATE INDEX IF NOT EXISTS idx_visits_day ON site_visits(DATE(created_at));` <br>4. En Supabase, créer une table `site_visits_daily` déjà agrégée par jour que le scraper insère à chaque nouvelle visite (déjà partiellement existante selon le code : `supabase.from("site_visits_daily").select("day,visits")`). <br>5. Modifier `getAdminAnalyticsData()` pour préférer les tables agrégées quand disponibles, avec fallback vers le calcul JS sur l'échantillon. |
| **Risques** | - La table `site_visits_daily` existe peut-être pas dans toutes les installations (migration 0006 non appliquée mentionnée dans le code). <br>- Déconnexion entre `site_visits` (raw) et `site_visits_daily` (agrégée) si le scraper ne met pas à jour les deux. <br>- Les requêtes SQL agrégées Supabase peuvent coûter des egress bytes supplémentaires si les données traversent le réseau. |
| **Tests nécessaires** | Vérifier que la table `site_visits_daily` existe ou doit être créée. Tester le fallback JS quand la table agrégée est vide ou absente. Valider que les chiffres correspondent entre calculs SQL et JS (écart < 1% attendu). |
| **Statut** | À FAIRE |

---

## P3-04 : Étudier le cache de `/api/admin/search`

| Champ | Détails |
|-------|---------|
| **Identifiant** | P3-04 |
| **Priorité** | P2 |
| **Fichier concerné** | `src/app/api/admin/search/route.ts` — lignes 36-40 |
| **Problème identifié** | La route `GET /api/admin/search?q=...` exécute trois requêtes DB en parallèle via `Promise.allSettled()` : <br>1. `searchOffers(query, maxPerCategory)` → `JobOfferSchemaService.list()` <br>2. `searchBlog(query, maxPerCategory)` → `BlogService.list()` <br>3. `searchEntreprendre(query, maxPerCategory)` → `EntreprendreArticleService.list()` <br>Aucune mise en cache n'est appliquée entre ces trois modules. Chaquerequête de recherche admin déclenche 3 round-trips base de données + traitement résultat. Pour un trafic admin fréquent, cela multiplie la consommation CPU par 3. |
| **Action recommandée** | 1. Ajouter `unstable_cache` Next.js sur la fonction GET, avec tags appropriés (`['admin-search']`) et un TTL raisonnable (ex: 60 ou 120 secondes). <br>2. Ou créer une fonction cache manuelle utilisant `NodeCache` ou `lru-cache` en mémoire, invalidée manuellement après publication nouvelle offre/blog/entreprendre article. <br>3. Ou regrouper les trois requêtes en une seule procédure stockée DB si la charge le justifie. <br>4. S'assurer que le cache est invalidé par les événements de publication (via `revalidateBlogSurfaces`, événements Supabase, etc.). |
| **Risques** | - Le cache peut servir des résultats "temps dépassé" si l'admin s'attend à des résultats toujours à jour. <br>- L'invalidation du cache doit être fiable ; si elle rate, les résultats deviennent obsolètes. <br>- Mémoire cache côté serveur peut croître si de nombreuses requêtes différentes sont faites. |
| **Tests nécessaires** | Valider que le cache sert les mêmes résultats que les requêtes DB pour la même query. Tester l'invalidation après création nouvelle offre/blog/article. Vérifier que le cache ne sert pas de résultats mélangés entre différentes queries de recherche. |
| **Statut** | À FAIRE |

---

## P3-05 : Évaluer le coût CPU de `recommendationScoring.ts` avec des volumes réalistes

| Champ | Détails |
|-------|---------|
| **Identifiant** | P3-05 |
| **Priorité** | P2 |
| **Fichier concerné** | `src/lib/recommendationScoring.ts` — fonctions `scoreJob()`, `rankJobs()` |
| **Problème identifié** | Le barème `scoreJob()` effectue pour chaque offre : <br>- Normalisation texte `normalizeText()` du titre + description <br>- Correspondance secteur : colonne `sector` exacte OU balayage de tous les `SECTOR_KEYWORDS` (13 catégories × plusieurs mots-clés chacune) <br>- Correspondance ville `matchesCity()` <br>- Correspondance compétences : filtre profileSkills + `matchesKeyword()` par compétence <br>- Niveau expérience : lookup `EXPERIENCE_LEVEL_KEYWORDS` + `matchesKeyword()` <br>- Diplôme : lookup `DIPLOMA_KEYWORDS` + `matchesKeyword()` <br>- Fraîcheur : `daysSince()` calcul <br>- Vérification `is_verified` <br>Chaque appel `rankJobs(profile, jobs, limit)` scala O(N × K) où N = nombre d'offres, K = nombre de vérifications par offre. Bien que purement JavaScript (pas d'I/O), avec 200 offres et 13 secteurs + compétences + expérience + diplôme, le coût peut devenir notable sur chaque requête `/api/recommendations`. |
| **Action recommandée** | 1. Chronométrer `scoreJob()` avec des scénarios réalistes : 50, 100, 200 offres avec profils variés. <br>2. Vérifier si le bottleneck est le nombre de vérifications ou la complexité des expressions régulières `matchesKeyword`. <br>3. Envisager de pré-calculer les scores pour les profils statiques et les mettre en cache. <br>4. Option : simplifier le barème ou rendre certaines pondérations optionnelles selon la charge. <br>5. Le module est déjà `pur` (aucun import serveur) — avantage pour le cache côté client ou memoïsation. |
| **Risques** | - Le score actuel est un élément de différenciation du produit ; toute simplification doit être validée avec les utilisateurs/ stakeholders. <br>- Le module est testé ; toute modification doit conserver la compatibilité des scores existants (tests unitaires). |
| **Tests nécessaires** | Exécuter `rankJobs()` avec 50/100/200 offres chronométrer. Comparer les temps d'exécution. S'assurer que tous les tests existants passent après toute modification. |
| **Statut** | À FAIRE |

---

## P3-06 : Examiner le coût de traitement de `/api/analytics/track`

| Champ | Détails |
|-------|---------|
| **Identifiant** | P3-06 |
| **Priorité** | P3 |
| **Fichier concerné** | `src/app/api/analytics/track/route.ts` — lignes 105-160 |
| **Problème identifié** | La route `POST /api/analytics/track` effectue à chaque appel : <br>1. Vérification rate limit `isRateLimited()` — DB query ou vérification mémoire (according to implementation) <br>2. Extraction IP + `getClientIp()` <br>3. Hashage IP : `Buffer.from(ip).toString("base64").slice(0, 16)` — opération crypto Node <br>4. Import dynamique `import("node:sqlite")` — module natif chargé à chaque appel (fallback) <br>5. Création table `site_visits` si inexistante + migration défensive `PRAGMA table_info` <br>6. Insert SQLite ou Supabase selon configuration <br>Bien que chaque opération soit rapide individuellement, le taux de réussite de cette route peut être élevé (chaque page view ou interaction utilisateur peut déclencher un tracking). Le hash IP à chaque requête et le import dynamique `node:sqlite` ajoutent un surcoût non négligeable à échelle millions de requêtes. |
| **Action recommandée** | 1. Mesurer le temps d'exécution réel de la fonction avec `console.time` ou un middleware de profilage. <br>2. Envisager de déplacer le rate limiting et le hash IP vers un middleware global Next.js plutôt que par requête. <br>3. Pour SQLite fallback : considérer un mécanisme de batch / écriture groupée plutôt qu'une ouverture/fermeture de DB à chaque requête. <br>4. S'assurer que le chemin Supabase (production) est privilégié et que le fallback SQLite n'est activé que rarement. <br>5. Vérifier si `isRateLimited()` peut être mémorisé en mémoire Redis ou en-cache en Next.js pour éviter les DB queries répétées. |
| **Risques** | - Tout changement au tracking doit garder la compatibilité avec le fallback SQLite pour les environnements sans Supabase. <br>- Le rate limiting doit rester efficace ; le mise en cache ne doit pas contourner la limite de 200/10min par IP. |
| **Tests nécessaires** | Profiler le temps d'exécution complet de `POST /api/analytics/track` avec `console.time` ou `clinic`. Tester que le rate limiting fonctionne toujours correctement avec toute optimisation. Valider que le fallback SQLite fonctionne toujours en l'absence de Supabase. |
| **Statut** | À FAIRE |

---

## P3-07 : Définir un suivi des métriques Vercel CPU Active Usage avant/après optimisation

| Champ | Détails |
|-------|---------|
| **Identifiant** | P3-07 |
| **Priorité** | P3 |
| **Fichier concerné** | Aucun fichier source — configuration et monitoring |
| **Problème identifié** | Sans métriques de base, il est impossible de quantifier l'impact réel des optimisations Phase 3. Vercel fournit des métriques CPU dans le dashboard, mais sans point de référence avant les optimisations, les gains sontSubjectifs. De plus, les seuils de quota (ex: quota CPU 94% mentionné dans le commentaire de `page.tsx`) doivent être suivis dans le temps. |
| **Action recommandée** | 1. Ajouter des métriques de logging personnalisées dans les points chauds identifiés : <br>   - `homeCarousel.ts` : compter le nombre de fois `fetchOgImage` est appelé, temps de réponse moyen. <br>   - `admin-analytics.ts` : chronométrer la durée totale de `getAdminAnalyticsData()`. <br>   - `page.tsx` : logger le nombre de re-renders ISR par heure. <br>   - `api/analytics/track/route.ts` : logger le temps total par requête, taux de fallback SQLite. <br>2. Configurer des tableaux de bord Vercel custom ou des logs externes (Datadog, LogRocket, etc.) pour suivre ces métriques dans le temps. <br>3. Enregistrer les valeurs de base AVANT toute modification. <br>4. Après optimisation, comparer les nouvelles métriques aux valeurs de base. |
| **Risques** | - Ajouter du logging peut lui-même consommer un peu de CPU ; il faut mesurer l'impact secondaire. <br>- Les métriques Vercel peuvent ne pas être aussi granulaires que des profils personnalisés. |
| **Tests nécessaires** | Établir les valeurs de base actuelles sur un échantillon représentatif de trafic. Après optimisation, vérifier que les métriques ont évolué dans la bonne direction. |
| **Statut** | À FAIRE |

---

## Suivi Global des Tâches

| ID | Priorité | Statut |
|----|----------|--------|
| P3-01 | P1 | À FAIRE |
| P3-02 | P1 | TERMINÉ |
| P3-03 | P1 | À FAIRE |
| P3-04 | P2 | À FAIRE |
| P3-05 | P2 | À FAIRE |
| P3-06 | P3 | À FAIRE |
| P3-07 | P3 | À FAIRE |

**Règle** : Aucune tâche n'est marquée TERMINÉe par simple analyse. Seule une implémentation validée par des tests confirme le complet.
# Rapport final - Optimisation CPU Vercel & étude Cloudflare

Date : 13 novembre 2026
Projet : TravaillerenCi (Next.js 16.3.2, React 19, Supabase + repli SQLite)
Objectif : réduire durablement la consommation Vercel Fluid Active CPU, sans régression fonctionnelle, puis évaluer une migration Cloudflare.

---

## 1. Synthèse exécutive

Le poste de coût principal n'était pas le scraper (GitHub Actions) ni les API IA, mais :

1. le **proxy Next.js 16** (`src/proxy.ts`), qui s'exécutait en runtime Node sur **presque toutes les pages publiques** ;
2. des pages publiques en **`force-dynamic`** ou sans ISR, rendues côté serveur à chaque visite ;
3. la **home en ISR 60 s**, régénérée jusqu'à ~1 440 fois/jour ;
4. un **tracking analytics** à une invocation par page/événement ;
5. un **sondage** interrogé à chaque montage de la home ;
6. des **calculs SEO répétés** sur un vivier de 500 offres à chaque rendu de `/jobs` et `/stages`.

Les optimisations ci-dessous ont été appliquées. Le build de production passe, les tests unitaires passent, et un smoke test local valide les routes et les API modifiées.

Le projet reste sur Vercel pour l'instant. Une migration Cloudflare est **faisable**, mais demande de retirer plusieurs dépendances Node incompatibles avec Workers (`node:sqlite`, `node:fs`, `node:child_process`, `node:dns`). Recommandation : mesurer 48-72 h après déploiement ; migrer seulement si le quota reste élevé.

---

## 2. Changements appliqués

### 2.1 Proxy Node limité aux surfaces protégées

Fichier : `src/proxy.ts`

- Le matcher ne couvre plus les pages publiques. Il ne reste que :
  - `/cz7tk`, `/cz7tk/:path*`
  - `/api/admin/:path*`
  - `/dashboard`, `/dashboard/:path*`
  - `/login`, `/register`, `/reset-password`
- Les pages publiques (statiques ou ISR) sont désormais servies par le CDN sans exécuter de fonction Node.
- Le drapeau `te_session` reste posé/supprimé à la connexion/déconnexion. Seules les sessions antérieures à l'introduction du drapeau peuvent afficher un état connecté différé sur une page publique ; elles expirent naturellement.

Impact attendu : suppression de la majorité des invocations de proxy, qui était le levier le plus large.

### 2.2 Pages publiques statiques

Suppression de `force-dynamic` sur :

- `src/app/about/page.tsx`
- `src/app/contact/page.tsx`
- `src/app/careers/page.tsx`
- `src/app/cgu/page.tsx`
- `src/app/politique-de-confidentialite/page.tsx`
- `src/app/dashboard/company/page.tsx`

Ces pages sont maintenant prérendues au build (`○` dans la table des routes).

### 2.3 ISR sur les listes et pages marketing

- `src/app/bourses/page.tsx` : `force-dynamic` -> `revalidate = 600`.
- `src/app/blog/[slug]/page.tsx` : `force-dynamic` -> `revalidate = 3600`.
  - `incrementViewCount()` n'est plus appelé à chaque visite, mais lors des régénérations (au plus une fois par heure), ce qui fiabilise aussi la charge.
- `src/app/page.tsx` : `revalidate` 60 s -> 300 s. La home reste fraîche immédiatement via `revalidatePath('/')`.
- `src/lib/cachedContent.ts` : TTL du cache des listes 120 s -> 300 s, pour que la home atteigne réellement 5 min (Next prend le minimum des TTL de l'arbre). La fraîcheur reste assurée par `revalidateTag(...)`.
- `src/app/publier-offre/page.tsx` : `revalidate` 60 s -> 3600 s, avec ajout de `revalidatePath('/publier-offre')` dans `src/lib/revalidateContent.ts`.

### 2.4 Cache des liens SEO villes/métiers

Fichiers : `src/lib/cachedJobVivier.ts`, `src/app/jobs/page.tsx`, `src/app/stages/page.tsx`

- Ajout de `getCachedJobSeoChips(activity)`, qui calcule une seule fois par verticale (emplois/stages) les hrefs des chips villes et métiers à partir du vivier de 500 offres.
- TTL 24 h, tags `job-offers` et `job-vivier` (invalidés à chaque publication).
- Les pages ne refont plus des milliers de comparaisons `landingChipHref` à chaque rendu.

### 2.5 Analytics groupé

Fichiers : `src/lib/analyticsClient.ts`, `src/components/analytics/AnalyticsTracker.tsx`, `src/app/api/analytics/track/route.ts`, `src/services/analyticsService.ts`

- Les visites et événements sont mis en file et envoyés en **un seul POST** :
  - flush différé de 1,5 s ;
  - flush immédiat à 25 entrées ;
  - flush sur `pagehide` / `visibilitychange` via `navigator.sendBeacon` pour ne rien perdre lors d'une navigation.
- La route accepte un tableau `batch` (max 50) et conserve le mode mono-événement pour compatibilité.
- `recordEvents()` fait un seul insert Supabase et déduplique les événements « une fois par utilisateur ».
- Sur Vercel, le fallback SQLite n'est plus tenté (FS en lecture seule).

Impact attendu : environ 5 à 20 fois moins d'invocations de fonction analytics par session.

### 2.6 Sondage de la home

Fichiers : `src/app/api/home/poll/route.ts`, `src/components/home/PollWidget.tsx`

- GET : cache HTTP `public, max-age=60, s-maxage=300, stale-while-revalidate=600` + cache mémoire 15 s.
- Sur Vercel : plus d'import `node:sqlite` ni de tentative d'écriture FS ; repli mémoire.
- Client : cache `sessionStorage` de 5 min, donc plus de fetch à chaque montage de la home.

### 2.7 Notifications admin

Fichier : `src/components/admin/NotificationCenter.tsx`

- Polling 60 s -> 120 s, et uniquement lorsque l'onglet est visible. Impact limité au trafic admin, mais évite des réveils inutiles.

---

## 3. Validation

| Vérification | Résultat |
| --- | --- |
| `npm run build` | OK (Next.js 16.3.2, TypeScript OK) |
| `npm test` | OK (toutes les suites, 0 échec) |
| ESLint ciblé sur les fichiers modifiés | OK (0 erreur, 0 avertissement) |
| Smoke test local (`next start`) | OK |

Routes testées en local :

| Route | Résultat |
| --- | --- |
| `/`, `/about`, `/contact`, `/careers`, `/cgu`, `/politique-de-confidentialite` | 200 |
| `/bourses`, `/jobs`, `/stages`, `/blog` | 200 |
| `/dashboard` sans session | 307 (proxy OK) |
| `/cz7tk` sans session | 307 (proxy OK) |
| `GET /api/home/poll` | 200 + en-têtes de cache |
| `POST /api/analytics/track` (batch) | 200, `visits:1`, `events:1` |
| `POST /api/analytics/track` (legacy) | 200 |
| Vérification SQLite locale | visites et événements bien insérés |

Table des routes après build (extrait) :

- Statique : `/`, `/about`, `/careers`, `/cgu`, `/contact`, `/politique-de-confidentialite`, `/dashboard/company`, `/bourses` (ISR 10 min), `/publier-offre` (ISR 1 h).
- Dynamique restant : `/jobs`, `/stages`, `/blog`, `/actualites`, `/concours`, et les routes API.

---

## 4. Gains attendus

Les valeurs ci-dessous sont des ordres de grandeur, pas des mesures Vercel.

| Levier | Avant | Après | Effet CPU attendu |
| --- | --- | --- | --- |
| Proxy | Fonction Node sur ~toutes les pages | Uniquement admin/dashboard/auth | Très fort |
| Pages statiques | SSR à chaque visite | CDN, zéro fonction | Fort |
| Home | ISR 60 s | ISR 300 s + invalidation ciblée | Fort |
| `/bourses` | SSR à chaque visite | ISR 600 s | Fort |
| `/blog/[slug]` | SSR à chaque visite | ISR 3600 s | Fort |
| Analytics | 1 invocation par événement | 1 invocation par lot | Moyen à fort |
| Sondage | 1 invocation par visite home | Cache CDN + navigateur + mémoire | Moyen |
| Chips SEO | Filtrage 500 offres par rendu | Calcul 1 fois/24 h | Moyen |
| Notifications admin | Toutes les 60 s | 120 s + visibilité | Faible |

Après déploiement, surveiller dans Vercel :

- Fluid Active CPU (objectif : rester sous 60-70 % du quota) ;
- nombre d'invocations de fonctions ;
- cache hit ratio CDN ;
- erreurs 5xx sur `/jobs`, `/stages`, `/bourses`, `/blog`.

---

## 5. Points restants (non modifiés volontairement)

Ces pages restent dynamiques car elles lisent `searchParams` :

- `/jobs`, `/stages` (recherche, ville, contrat, pagination) ;
- `/blog` (`?tag=`) ;
- `/actualites` (recherche, catégorie, pagination) ;
- `/concours` (filtres).

Elles représentent le principal coût CPU restant. Trois options, par ordre de prudence :

1. Ajouter un `Cache-Control` CDN (`s-maxage`) sur les variantes anonymes, après validation qu'aucune donnée de session n'est rendue côté serveur (c'est le cas aujourd'hui).
2. Rendre la liste par défaut statique/ISR et déplacer les filtres en client (`useSearchParams`), en conservant des URLs de filtres indexables.
3. Utiliser `"use cache"` / PPR si le projet passe à une version où ces fonctionnalités sont stables.

Également :

- `/jobs/[id]` : ISR 24 h sans `generateStaticParams`. Ajouter les N offres les plus vues en prérendu réduirait le premier hit dynamique.
- `/api/og/exam/[id]` : génération d'image CPU-heavy, déjà cachée 1 h. À garder hors du chemin critique.
- Dashboard admin : analytics/scraper restent gourmands mais à trafic faible.

---

## 6. Étude de migration vers Cloudflare

### 6.1 Verdict

Migration **techniquement faisable** avec `@opennextjs/cloudflare` (adaptateur OpenNext pour Workers). Next.js 16 est supporté, y compris l'App Router, les Server Actions, l'ISR et les Route Handlers. Le support de `proxy.ts` (middleware Node de Next 16) est récent (PR mergée mi-2026) : à valider impérativement en preview.

Cloudflare Pages « historique » n'est plus la bonne cible pour Next.js. La cible recommandée est **Cloudflare Workers + Workers Assets** via OpenNext.

### 6.2 Blocages à traiter avant migration

Le code utilise des API Node incompatibles avec le runtime Workers :

| Dépendance | Fichiers concernés | Impact | Solution |
| --- | --- | --- | --- |
| `node:sqlite` | services, `admin-*.ts`, `api/home/poll`, `api/analytics/track` | Non supporté dans Workers | Supprimer le fallback SQLite en production, tout passer par Supabase (ou D1) |
| `node:fs` (écriture) | `admin-dashboard.ts`, `analyticsService`, etc. | FS Workers non persistant | Remplacer par Supabase/R2 ; garder SQLite en local uniquement |
| `node:child_process` | `admin-dashboard.ts` (scraper) | Non supporté | Déclencher GitHub Actions (`workflow_dispatch`) au lieu de lancer Python |
| `node:dns/promises` | `api/admin/exams/similarity` | Non supporté tel quel | DNS-over-HTTPS via `fetch`, ou validation d'URL sans résolution DNS |
| `process.cwd()` + chemins `data/` | nombreux services | Inexistant sur Workers | Chemins uniquement en dev ; production 100 % Supabase |
| `next/image` optimization | global | Cloudflare Images payant ou loader custom | `images.unoptimized` ou loader Cloudflare Images |
| `vercel.json` headers | racine | Non lu par Workers | Reporter dans `_headers` / config Wrangler |
| ISR / Data Cache | global | Nécessite un cache binding | Configurer KV ou R2 via OpenNext |

Le point le plus lourd est `node:sqlite` : plusieurs modules l'importent **statiquement**, donc le build OpenNext peut échouer même si la production utilise Supabase. Il faut soit des imports dynamiques conditionnels, soit une séparation nette `local` / `production`.

### 6.3 Architecture cible

- **Cloudflare Workers** : rendu Next.js via OpenNext.
- **Workers Assets** : fichiers statiques, cache CDN gratuit.
- **KV ou R2** : cache ISR/Data Cache (R2 recommandé si volume de pages important).
- **Supabase** : conservé tel quel (Postgres + Auth applicatif).
- **GitHub Actions** : scraper et cron existants, déclenchés par `workflow_dispatch`.
- **Cloudflare Images** (optionnel) : optimisation d'images, sinon `unoptimized`.
- **Secrets** : variables Wrangler / dashboard Cloudflare.

### 6.4 Coûts

Tarifs vérifiés en novembre 2026 :

- **Workers Free** : 100 000 requêtes/jour, 10 ms de CPU par invocation. Les assets statiques sont gratuits et illimités. Trop juste pour du SSR Next.js régulier.
- **Workers Paid** : 5 $/mois minimum, inclut 10 millions de requêtes et 30 millions de CPU-ms (≈ 8,3 heures de CPU), puis 0,30 $/million de requêtes et 0,02 $/million de CPU-ms.
- **KV** : lectures 0,50 $/million (10 M inclus), écritures 5 $/million (1 M inclus).
- **R2** : stockage et opérations facturés séparément, egress gratuit.

Estimation pour TravaillerenCi après optimisation :

- trafic majoritairement statique servi par le CDN : gratuit ;
- pages dynamiques restantes (`/jobs`, `/stages`, `/blog`, `/actualites`, `/concours`) : quelques centaines de milliers de requêtes/mois ;
- CPU estimé : quelques millions de CPU-ms/mois, très en dessous des 30 M inclus ;
- coût probable : **5 $/mois**, hors éventuel dépassement KV.

À comparer au plan Vercel Hobby (4 h de Fluid Active CPU incluses) et au passage Pro (~20 $/mois) si le quota est dépassé.

### 6.5 Plan de migration recommandé

1. **Geler les optimisations Vercel** et mesurer 48-72 h.
2. Créer une branche `cloudflare-preview` avec `@opennextjs/cloudflare` + Wrangler.
3. Rendre Supabase obligatoire en production : supprimer les imports statiques `node:sqlite` des modules chargés en prod.
4. Remplacer le déclenchement du scraper (`child_process`) par un appel GitHub Actions.
5. Remplacer `node:dns` de la route de similarité par DNS-over-HTTPS.
6. Configurer KV/R2 pour le cache ISR et vérifier `proxy.ts` en preview.
7. Désactiver ou externaliser l'optimisation d'images.
8. Tester : build, lint, tests unitaires, e2e, parcours auth/admin, publication d'offre, analytics.
9. Déployer en preview Cloudflare, comparer CPU/prix et stabilité sur 1 semaine.
10. Basculer le DNS seulement après validation.

Effort estimé :

- site public + routes API principales : 1 à 3 jours ;
- parité admin complète (scraper, analytics, logs) : 2 à 4 jours supplémentaires.

### 6.6 Recommandation

**Rester sur Vercel à court terme** avec les optimisations appliquées. Si après 72 h le Fluid Active CPU reste supérieur à ~70-80 % du quota, ou si les dépassements deviennent récurrents, **migrer vers Cloudflare Workers Paid (5 $/mois)**. La migration est rentable à moyen terme, mais elle introduit une dette technique sur les fonctionnalités admin qui reposent sur le FS local et `child_process`.

---

## 7. Rollback

Les changements sont isolés et réversibles :

- proxy : restaurer l'ancien matcher ;
- pages : réintroduire `force-dynamic` et les anciens TTL ;
- analytics : le mode mono-événement reste accepté par la route ;
- sondage : les en-têtes et caches sont optionnels, le comportement fonctionnel reste identique.

Aucun schéma Supabase, aucune migration de données et aucun design n'ont été modifiés.

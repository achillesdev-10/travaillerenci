# Rapport final de phase — TravaillerEnCi (Master Prompt V2)

> Période couverte : phase complète « Priorités 1 à 8 + sections 13 à 42 » du Master Prompt 2.
> Branche : `main` — 33 commits en avance sur `origin/main` (non poussés).
> Vérifications finales (2026-10-02) : `npm run lint` ✅ · `npm test` ✅ (12 suites, 318 tests, 0 échec) · `npx tsc --noEmit` ✅ · `npm run test:e2e` ✅ (73 tests, 0 échec) · `npm run build` ✅

---

## 1. Fonctionnalités ajoutées

**Espace candidat (Priorités 1-6)**
- Enrichissement du profil candidat (métier recherché, expérience, compétences, contrats, bio, lien CV) + indicateur « Profil complété à X % » (11 critères).
- Recommandations d'offres calculées depuis le profil (`recommendationScoring` + `GET /api/recommendations`) et affichées dans le dashboard.
- Bénéfices du compte + CTA clairs sur la page d'accueil.
- **Consentement de visibilité du profil** (`profile_visibility`, défaut strictement `private`) — base de la future CVthèque (§30).

**Offres et SEO (Priorités 7-8, sections 12-18, 33-35)**
- Catégorisation des offres par métier : colonne `job_offers.sector` + `sectorClassifier` + script `scripts/classify-job-sectors.ts`.
- Pages d'atterrissage SEO « offre par ville » et « offre par métier » (`src/app/[landing]/page.tsx`), maillage conditionnel par seuils d'offres réelles.
- Nouvelle page `/jobs/today` (ISR 1 h) : offres des dernières 24 h + bloc « Offres à ne pas manquer » (score fraîcheur/popularité/déadline) + JSON-LD ItemList/Breadcrumb + entrée au sitemap.
- Maillage interne blog ↔ offres (`relatedContent.ts`) : chaque article affiche ses offres liées, chaque fiche affiche ses articles pertinents.

**Partage & analytics (sections 21-22)**
- URLs partagées taggées en UTM (`shareUtm.ts`, source `share`), événements `share` (bouton natif/copie **et** liens sociaux via `ShareClickTracker`).
- Fiche d'offre : boutons **WhatsApp, Facebook, LinkedIn, Partager/Copier, Sauvegarder** (§14-§15).
- Événements suivis : `job_view`, `job_save`, `job_unsave`, `signup`, `profile_complete`, `cv_upload`, `alert_create`, `application_click`, `search`, `share`, `newsletter_subscribe`.

**Dashboard administrateur (section 23)**
- Statistiques de croissance (`admin-growth.ts`) : inscriptions, profils, alertes, sauvegardes (voir aussi les sources de trafic dans le lot final ci-dessous).

**Newsletter (section 20)**
- Table + service + API d'inscription, désinscription en un clic, formulaire dans le pied de page. **Aucun envoi** : seuls les champs nécessaires sont posés (statuts, consentement horodaté, source, UTM, fréquence, jetons de confirmation/désinscription).

**Reprise des sections restantes (lots finaux)**

- **§6/§7 (inscription)** : page `/register` affiche la valeur de la plateforme ; bouton « Sauvegarder » des fiches explicite l'invitation à créer un compte pour les visiteurs non connectés.
- **§8 (alertes)** : critères **type de contrat** et **mots-clés** ajoutés à `AlertsSection` (création + édition, chips, listes déroulantes) ; API `POST/PATCH /api/alerts` accepte `contract_type` / `keywords` ; digest `scraper/alert_digest.py` applique le matching (contrat en sous-chaîne, mots-clés ≥ 1 dans titre/entreprise/description).
- **§10 (recommandations)** : scoring enrichi des **compétences** (20 pts) et du **niveau d'expérience** (10 pts) ; chaque recommandation affiche ses **raisons** (« Compétence React », « Profil Senior »…).
- **§12/§13/§17 (SEO)** : chips villes/métiers conditionnés (jamais de 404), canonique + OpenGraph + Twitter + `BlogPosting` sur le blog, filtre d'étiquette `/blog?tag=…`.
- **§15 (partage)** : libellés « **Partager cette offre** » et « **Copier le lien** » (`CopyLinkButton`).
- **§18 (accueil)** : phrase centrale du §18 + accès directs Offres / Stages / Recherche / **Alertes** / CV / Profil.
- **§23 (admin)** : « **Sources de trafic** » (colonnes `site_visits.source`, `src/lib/trafficSource.ts`, graphe du dashboard), **offres publiées** et **entreprises** dans le dashboard admin.
- **§24 (base de données)** : audit du schéma existant + **mapping documenté** (§5 ci-dessous) ; aucune table dupliquée, migrations sûres (`ADD COLUMN IF NOT EXISTS`, contraintes, index).
- **§26 (mobile first)** : suite `e2e/responsive.spec.ts` — 320/360/390/412/tablette/desktop, 7 pages publiques + fiche d'offre + dashboard + menu hamburger, **aucun débordement horizontal**.
- **§27 (accessibilité)** : labels `htmlFor/id` + `aria-label` sur tous les champs (login, inscription, générateur de CV), groupes `role="group"`/`aria-pressed`, messages d'erreur `role="alert"` ; suite `e2e/accessibility.spec.ts` (noms accessibles, `alt`, landmark/`h1`, focus clavier, contraste ≥ 4,5:1, cible tactile ≥ 40 px).
- **§29 (monétisation)** : champs de statut **neutres uniquement** — `job_offers.is_featured`/`featured_until`, `candidate_profiles.plan` (`free`/`premium`) ; **aucun bouton de paiement**, aucun tri ni affichage particulier.

---

## 2. Fichiers principaux modifiés

| Domaine | Fichiers |
|---|---|
| Profil candidat | `src/services/candidateProfileService.ts`, `src/app/api/candidate/profile/route.ts`, `src/components/dashboard/ProfileSection.tsx`, `src/lib/profileCompletion.ts`, `src/lib/profileVisibility.ts` |
| Offres / SEO | `src/lib/jobSeo.ts`, `src/lib/mustSee.ts`, `src/lib/sectorClassifier.ts`, `src/lib/relatedContent.ts`, `src/app/[landing]/page.tsx`, `src/app/jobs/today/page.tsx`, `src/app/jobs/[id]/page.tsx`, `src/app/sitemap.ts`, `src/app/page.tsx` |
| Partage | `src/lib/shareUtm.ts`, `src/components/ShareButton.tsx`, `src/components/analytics/EventTracker.tsx` (`ShareClickTracker`) |
| Analytics | `src/lib/analyticsEvents.ts`, `src/lib/analyticsClient.ts`, `src/services/analyticsService.ts`, `src/app/api/analytics/track/route.ts` |
| Recommandations | `src/lib/recommendationScoring.ts`, `src/services/recommendationService.ts`, `src/app/api/recommendations/route.ts` |
| Newsletter | `src/lib/newsletter.ts`, `src/services/newsletterService.ts`, `src/app/api/newsletter/route.ts`, `src/app/api/newsletter/unsubscribe/route.ts`, `src/components/layout/NewsletterForm.tsx`, `src/components/layout/Footer.tsx` |
| Admin | `src/lib/admin-growth.ts`, `src/app/cz7tk/(protected)/AdminDashboardClient.tsx` |
| Alertes (§8) | `src/components/dashboard/AlertsSection.tsx`, `src/services/alertService.ts`, `src/types/alerts.ts`, `src/app/api/alerts/route.ts`, `scraper/alert_digest.py`, `scraper/tests/test_alert_digest.py` |
| Recommandations (§10) | `src/lib/recommendationScoring.ts`, `src/services/recommendationService.ts`, `src/components/dashboard/RecommendationsSection.tsx` |
| Trafic (§23) | `src/lib/trafficSource.ts`, `src/app/api/analytics/track/route.ts`, `src/components/analytics/AnalyticsTracker.tsx`, `tests/trafficSource.test.ts` |
| Monétisation (§29) | `src/services/jobOfferSchemaService.ts`, `src/services/candidateProfileService.ts`, `src/types/index.ts` |
| Accessibilité (§27) | `src/app/login/page.tsx`, `src/components/auth/{RegisterForm,PasswordInput,ResetPasswordForm,SetPasswordForm}.tsx`, `src/components/cv/CVForm.tsx` |
| Partage / accueil | `src/components/CopyLinkButton.tsx`, `src/components/ShareButton.tsx`, `src/components/saved/SaveButton.tsx`, `src/app/page.tsx`, `src/app/register/page.tsx` |
| Outils | `scripts/apply-content-migrations.ts`, `scripts/classify-job-sectors.ts`, `package.json` (script `test`) |
| Tests E2E | `e2e/accessibility.spec.ts` (§27), `e2e/responsive.spec.ts` (§26), `e2e/blog.spec.ts`, `e2e/jobs.spec.ts`, `e2e/search.spec.ts` |

---

## 3. Migrations créées

| Fichier | Contenu |
|---|---|
| `supabase/migrations/0025_add_job_sector.sql` | colonne `job_offers.sector` + index |
| `supabase/migrations/0026_enrich_candidate_profiles.sql` | `job_title`, `experience_level`, `skills`, `contract_types`, `bio`, `resume_url` |
| `supabase/migrations/0027_create_analytics_events.sql` | table `analytics_events` |
| `supabase/migrations/0028_add_profile_visibility.sql` | **consentement** `profile_visibility` (`private` par défaut, check contraint) |
| `supabase/migrations/0029_newsletter_subscribers.sql` | table `newsletter_subscribers` (statut, consentement, source, UTM, fréquence, jetons, RLS fermée) |
| `supabase/migrations/0030_alerts_contract_keywords.sql` | `alerts.contract_type` (check CDI/CDD/Stage/Prestation/Alternance/Freelance) + `alerts.keywords` (§8) |
| `supabase/migrations/0031_site_visits_source.sql` | `site_visits.source` + index (§23 — sources de trafic) |
| `supabase/migrations/0032_monetization_flags.sql` | `job_offers.is_featured` / `featured_until` + index, `candidate_profiles.plan` (`free`/`premium`) (§29) |

Aucune donnée existante n'a été supprimée. Les équivalents SQLite sont créés automatiquement au premier accès (migrations défensives dans les services).
**À faire côté production** : appliquer 0025 → 0032 (Supabase SQL Editor ou `supabase db push` ; 0030 à 0032 sont aussi référencées dans `scripts/apply-content-migrations.ts`, prochain numéro de migration : **0033**).

---

## 4. Nouvelles routes

- `GET /jobs/today` — page « Offres du jour » (ISR 3600 s).
- `GET /[landing]` — landings SEO ville/métier (page dynamique unique).
- `GET /api/recommendations` — recommandations du profil connecté.
- `POST /api/newsletter` — inscription (email + consentement obligatoire, rate limit 5/10 min/IP).
- `GET /api/newsletter/unsubscribe?token=…` — désinscription en un clic (HTML de confirmation, idempotent).

Aucune nouvelle route HTTP dans les lots finaux : `POST /api/alerts` (§8) et `GET /api/recommendations` (§10) existaient déjà et ont été **étendus** ; le tracking des sources (§23) passe par `POST /api/analytics/track` existant.

---

## 5. Nouvelles tables / champs

- `job_offers.sector` · `job_offers.is_featured` · `job_offers.featured_until` (§29)
- `candidate_profiles` : `job_title`, `experience_level`, `skills`, `contract_types`, `bio`, `resume_url`, **`profile_visibility`**, **`plan`** (§29)
- `alerts` : **`contract_type`**, **`keywords`** (§8)
- `site_visits` : **`source`** (§23)
- `analytics_events` (table)
- `newsletter_subscribers` (table)

### 5bis. Mapping des tables du §24 (audit du schéma existant)

Le §24 demande d'analyser le schéma avant toute création et d'adapter les noms au système déjà utilisé : **aucune table n'a été dupliquée**, voici la correspondance entre la liste de référence et le schéma réel (SQLite local + Supabase) :

| Référence §24 | Table(s) réelle(s) | Statut / décision |
|---|---|---|
| `users` | `users` (auth maison, `userRepository`), Supabase `public.users` (0011) + `password_reset_tokens`, `verify_email_tokens` | ✅ existante, inchangée |
| `profiles` | `public.profiles` (0002) + `public.profiles_candidate` / `public.profiles_company` ; côté SQLite : `candidate_profiles` (service) | ✅ existante — **ne pas recréer** |
| `resumes` | **pas de table** : CV côté client (générateur + export PDF), lien `candidate_profiles.resume_url`, bucket `cv_photos` (0008) | ⚠️ colonne `resume_url` suffisant pour l'instant ; table `resumes` à créer **avec** l'espace recruteur (CVthèque) |
| `saved_jobs` | `public.saved_items` (0016, type `job` / `article`) | ✅ nom adapté au système existant |
| `job_alerts` | `public.alerts` + `public.alert_digest_log` (0017) | ✅ existante, enrichie en 0030 |
| `candidate_skills` | colonne `candidate_profiles.skills` (JSON array, 0026) | ✅ relation portée par le profil — table dédiée inutile tant qu'aucun recruteur ne filtre par compétence |
| `companies` | **pas de table** : `public.profiles_company` (0002) + `job_offers.company` (texte) | ⚠️ **relation à créer** dans la phase recruteur (clé étrangère `job_offers.company_id`) — en évitant le doublon avec `profiles_company` |
| `company_profiles` | `public.profiles_company` (0002) | ✅ existante, inchangée |

Migrations sûres de bout en bout : SQLite défensif (`PRAGMA table_info` + `ALTER TABLE … IF NOT EXISTS`) doublé du SQL Supabase ; **aucune suppression de colonne ni de ligne**.

---

## 6. Changements SEO

- Landings SEO métier + ville avec filtres d'offres réels (seuils `MIN_OFFERS` / `MIN_COMBO_OFFERS`), liés au sitemap.
- **Maillage conditionné sans 404 (§12)** : helper `landingChipHref` dans `src/lib/jobSeo.ts` — un chip ville/métier pointe vers la landing SEO si elle atteint son seuil (même règle que le sitemap et le rendu de la landing), sinon vers la recherche filtrée de la verticale (`/jobs?city=…`, `/jobs?q=…`, `/stages?…`). Appliqué aux chips de `/jobs`, `/stages` et aux cross-liens de la page landing (vivier borné à 500, requête identique à celle de la landing).
- `/jobs/today` ajouté au sitemap ; titre de page en `%s | travaillerenci`.
- JSON-LD étendu : `JobPosting`, `ItemList`, `BreadcrumbList`, OpenGraph/Twitter complets sur les fiches.
- **Blog (§13/§17)** : canonique + OpenGraph (`type: article`, dates, auteur, étiquettes) + Twitter card sur chaque article, canonique auto-référent sur `/blog` (et `/blog?tag=…`), `title` sans double marque (suffixe du layout), JSON-LD `BlogPosting` (faits réels de l'article uniquement).
- **Étiquettes blog maillées (§17)** : les tags d'un article sont des liens vers `/blog?tag=…` ; nouveau filtre `tag` exact (élément entier) dans `BlogService.list` (SQLite + Supabase), bannière « Étiquette » + retour vers tous les articles.
- Maillage interne bidirectionnel article ↔ offre + liens « explorer davantage » (ville/métier/secteur).
- URLs de partage canoniques avec UTM (meilleure attribution des partages).

---

## 7. Améliorations de performance

- ISR/révalidation ciblée (`/jobs/today` 1 h, fiches 300 s, sitemap 1 j) plutôt que rendus dynamiques inutiles.
- Requêtes bornées (vivier de 500 offres, listes limitées, index sur les colonnes triées).
- Aucune nouvelle dépendance lourde ajoutée ; composants clients limités (boutons, formulaires).
- Rapports Lighthouse disponibles hors versioning : `lighthouse-report.json`, `lighthouse-report-v2.json`.

---

## 8. Améliorations de sécurité

- **Consentement** : profil privé par défaut ; newsletter refusée sans consentement explicite stocké (texte + horodatage).
- Rate limiting sur `POST /api/newsletter` (IP), validation stricte d'email.
- RLS Supabase fermée côté client (`candidate_profiles`, `newsletter_subscribers`) — accès serveur uniquement.
- Aucune donnée personnelle dans l'analytics : libellés = identifiant d'objet ou source de formulaire (jamais d'email).
- Contrôles d'accès inchangés et vérifiés : `/api/candidate/profile` et `/api/alerts` renvoient **401** sans session ; proxy `/cz7tk/*`, `/api/admin/*`, `/dashboard/*` protégés.
- **Plus de secrets en dur** (§28) : `adminSession.ts` et `sessionToken.ts` n'utilisent plus de mot de passe/jeton par défaut embarqué — fallbacks réservés au développement local, **fail-closed en production** (login refusé sans `ADMIN_EMAIL`/`ADMIN_PASSWORD`, sessions refusées sans `ADMIN_SESSION_SECRET`).
- **`POST /api/news` fermé par défaut** : `CRON_SECRET` obligatoire (s'il n'est pas configuré, la route renvoie systématiquement 401).
- **Upload photo CV sous session** : `POST /api/cv/photo` exige une session utilisateur ou admin (401 `auth_required` sinon) ; le générateur anonyme conserve l'aperçu local blob: (message explicite dans `CVForm`).
- **Modération des actualités** : le pipeline news insère désormais en `draft` ; la publication passe par `/cz7tk/actualites` (étape VALIDATION du §31), API `PATCH/DELETE /api/admin/articles/[id]` protégées par `requireAdminApi`.
- Variables de sécurité documentées dans `.env.example` (section « fail-closed »).

---

## 9. Tests réalisés

- `npm test` → **12 suites, 318 tests, 0 échec** :
  `analyticsEvents`, `jobSeo`, `jobThumbnails`, `mustSee`, `newsletter`, `profileCompletion`, `profileVisibility`, `recommendationScoring`, `relatedContent`, `sectorClassifier`, `shareUtm`, **`trafficSource`** (§23).
  (assertions `landingChipHref` §12, scoring `skills`/expérience + reasons §10, `recommendationScoring` porté à 46 tests.)
- `python scraper/tests/test_alert_digest.py` → **26 tests, OK** (matching contrat + mots-clés §8, y compris « offre sans contrat → pas de match »).
- **`npm run test:e2e` (Playwright) → 73 tests, 0 échec** (chaîne `chrome` système, serveur dev local, fixtures SQLite injectées puis nettoyées) :
  `admin` (§36), `auth` (inscription / connexion / déconnexion), `blog` (liste, fiche, canonique + `BlogPosting`, maillage des étiquettes §17), `chatbot`, `cv-pdf-export`, `cv-pdf-mobile`,
  `jobs` (recherche, filtres, fiche, `/stages`, `/jobs/today`, landing métier×ville, **§12 : tous les chips villes/métiers de `/jobs` et `/stages` répondent 200**, sitemap/robots),
  `profile` (profil absent → incomplet → complet, §30), **`responsive` (§26 : 9 tests** — 320/360/390/412/768/1280 px sur 7 pages publiques, fiche d'offre, dashboard, menu hamburger),
  **`accessibility` (§27 : 10 tests** — champs/boutons/image/structure sur 5 pages, focus clavier, message `role="alert"`, contraste ≥ 4,5:1, cible tactile ≥ 40 px, label du profil),
  `saved-alerts` (sauvegarde + alertes §36), `search` (débounce, soumission, état vide).
  Couverture des cas §36 : utilisateur connecté / non connecté / sans profil / profil incomplet / profil complet.
- `npm run lint` → 0 erreur ; `npx tsc --noEmit` → 0 erreur ; `npm run build` → ✓ Compiled successfully.
- Tests manuels (dev server) :
  - `POST /api/newsletter` → **201** (email valide + consentement), **400** (email invalide), **400** (consentement absent) ;
  - ré-inscription idempotente (1 seule ligne, pas de doublon d'événement) ;
  - désinscription via jeton → confirmation, **idempotente**, jeton invalide → message « lien invalide » ;
  - ré-inscription après désinscription → réactivation + renouvellement du consentement/jeton ;
  - page d'accueil, `/jobs`, `/jobs?q=…`, `/jobs/today`, article blog, `sitemap.xml` → **200** ;
  - fiche d'offre (offre injectée puis retirée) → **200** avec WhatsApp, Facebook, LinkedIn, Sauvegarder, Source, JSON-LD.
- Tests manuels — correctifs sécurité (batch audit Master Prompt 2) :
  - `POST /api/news` sans token / avec token invalide → **401** (fail-closed), `GET /api/news` → **200** ;
  - `POST /api/cv/photo` sans session → **401** `auth_required` ;
  - login admin (fallback dev) → **200** ; page `/cz7tk/actualites` → **200** ;
  - cycle de modération complet : `PATCH/DELETE` sans session → **401**, statut invalide → **400**, `draft → published` → **200** (`published_at` renseigné), article visible sur `/actualites` puis invisible après dépublication, suppression → **200**.

---

## 10. Résultat du build

```
npm run lint        → 0 erreur
npm test            → 12 suites / 318 tests / 0 échec
npx tsc --noEmit    → 0 erreur
python scraper/tests/test_alert_digest.py → 26 tests / OK
npm run test:e2e    → 73 tests / 0 échec   (12 min, 1 worker, Chrome système)
npm run build       → ✓ Compiled successfully (exit 0)
```
Avertissement connu et préexistant (non bloquant) : « Dynamic filesystem access causes tracing of the whole project » provenant du lancement du scraper Python (`fail(...)`), plus les warnings expérimentaux `node:sqlite`.

---

## 11. Commits effectués (33 de code, non poussés — le présent rapport est le commit suivant)

```
4d70edf test(e2e): allonger les attentes de navigation de la recherche (dev lent)
17648da feat(accessibilite): labels clavier, messages role alert et audit contraste (section 27)
7115dae feat(monetisation): champs de statut neutres offres mises en avant et plan de profil (section 29)
bb4fe28 feat(admin): offres publiees, entreprises et sources de trafic du dashboard (section 23)
aece22c feat(recommandations): scorer competences et experience, afficher les raisons (section 10)
5f6846c feat(alertes): critere contrat et mots-cles des alertes candidat (section 8)
36187e2 feat(home): afficher la phrase centrale et les acces directs offres/stages/recherche/alertes/CV/profil (section 18)
96cbda0 feat(partage): ajouter les libelles Partager cette offre et Copier le lien (section 15)
3f6c695 feat(auth): afficher la valeur de l'inscription et inviter les visiteurs a sauvegarder (sections 6 et 7)
66c52a2 feat(seo): conditionner les chips villes/metiers et bloguer le blog (sections 12, 13 et 17)
42b913b docs(rapport): integrer les correctifs de securite et la moderation actualites au rapport final
f6b7a9d feat(actualites): ajouter la file de moderation admin avant publication (sections 31 et 32)
912aaf5 fix(securite): exiger CRON_SECRET sur POST /api/news et une session sur l'upload photo CV (sections 28 et 31)
c242133 fix(securite): supprimer les secrets embarques et rendre les sessions fail-closed en production (section 28)
ae37e35 docs(rapport): ajouter la couverture E2E au rapport final de phase (section 42)
de1b6bf test(e2e): ajouter la suite Playwright des parcours sections 36 et 41
bed4ef5 fix(responsive): masquer les reseaux sociaux du header sous 2xl (section 26)
ad1868f chore(migrations): detecter les colonnes manquantes et les erreurs d'API Supabase
213b07c docs: ajouter le rapport final de phase (section 42)
ecae500 feat(newsletter): preparer l'architecture newsletter et alertes email (section 20)
f78291b feat(partage): ajouter Facebook et LinkedIn sur les fiches d'offre et tracer les partages sociaux (sections 14, 15 et 22)
c1f46bd feat(profile): ajouter le consentement de visibilite du profil candidat (section 30)
c27ebce feat(seo): maillage interne entre articles et offres (sections 16 et 33)
b6a7957 feat(jobs): ajouter la page Offres du jour et la selection a ne pas manquer
b95e253 feat(share): taguer les URLs partagees en UTM et mesurer les partages
24784e0 feat(analytics): suivre les recherches des utilisateurs (evenement search)
5f9f343 feat(admin): afficher les statistiques de croissance du dashboard
2416c4b feat(analytics): mesurer les événements clés du parcours candidat
71be441 feat(home): ajouter les bénéfices du compte et des CTA clairs
7beec36 feat(profile): enrichir le profil candidat et afficher sa complétion
ee19cbf feat(jobs): catégoriser les offres par métier via la colonne sector
05ce880 feat(seo): ajouter les pages d'atterrissage offres par ville et par métier
c97b6ce feat(dashboard): ajouter les recommandations d'offres par profil
```

(Ordre décroissant ; aucun commit non poussé sur `origin/main` — `git push` à valider par vos soins.)

---

## 12. Problèmes restants à traiter

1. **Migrations Supabase** : 0025 à 0032 doivent être appliquées sur le projet de production (aucune exécution automatique détectée).
2. **Envoi newsletter** : non implémenté (volontaire, §20) — le double opt-in (champ `confirm_token` déjà prévu) et le job d'envoi restent à faire.
3. **CVthèque** : aucun espace recruteur n'expose encore les profils ; le filtre `profile_visibility = 'recruiters'` devra être appliqué dès la création de cet espace, **avec** la table `resumes` et la table `companies` (clé étrangère `job_offers.company_id`) prévues au §24 — à créer alors, sans doublon avec `profiles_company`.
4. **Tests E2E** : la suite locale Playwright (`npm run test:e2e`, 73 tests) est verte ; la spec `chatbot.prod.spec.ts` (exécutée contre la production via `npm run test:e2e:prod`) reste un smoke à lancer manuellement. La suite n'est pas encore câblée en CI (`.github/workflows`).
5. Rapports Lighthouse non versionnés (`lighthouse-report*.json`) : à décider (commit ou ignorer).
6. Fichiers non versionnés restants : `Master Prompt 2.docx`, `master-prompt-2.txt`, logs `devserver.log` / `e2e-full*.log` / `build-final.log` (à ignorer via `.gitignore`).
7. **Audit Master Prompt 2 — état par section** :
   - §6/§7, §8, §10, §12/§13/§15/§17, §18, §23, §26, §27, §29, §31/§32 : **traités** (lignes de ce rapport + tests associés) ;
   - §24 : **traité sous forme d'audit + mapping** (§5bis) ; la création des tables `companies` / `resumes` reste délibérément reportée à l'espace recruteur pour éviter un doublon inutilisé ;
   - §33 : liens internes non conditionnés partout (maillage offre → entreprise **à faire avec `companies`**) ;
   - §41 : couverture E2E à étendre (dashboard admin avancé, protection des CV, événements analytics) et à mettre en CI.

---

## 13. Recommandations pour la prochaine phase

1. Pousser les 34 commits sur `origin/main`, appliquer les migrations 0025-0032 puis redéployer et vérifier en production.
2. Brancher l'envoi newsletter (double opt-in + digest hebdomadaire) en réutilisant le pipeline `scraper/alert_digest.py`.
3. Construire la CVthèque recruteur avec filtre de consentement + tables `companies` / `resumes` (§24, sans doublon avec `profiles_company`) + champs premium (§29) sans réécriture.
4. Étendre la suite E2E aux critères §41 encore peu couverts (dashboard admin avancé, protection des CV, événements analytics) et la lancer en CI ; ajouter l'audit `axe-core` en complément du contrôle de contraste/labels actuel.
5. Poursuivre le pipeline de qualité des offres (§31) : détection de doublons, normalisation, scoring de complétude ; finaliser le maillage offre → entreprise (§33) dès la table `companies` créée.

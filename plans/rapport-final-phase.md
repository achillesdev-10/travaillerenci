# Rapport final de phase — TravaillerEnCi (Master Prompt V2)

> Période couverte : phase complète « Priorités 1 à 8 + sections 13 à 42 » du Master Prompt 2.
> Branche : `main` — 19 commits en avance sur `origin/main` (non poussés).
> Vérifications finales : `npm run lint` ✅ · `npm test` ✅ (11 suites, 285 assertions, 0 échec) · `npm run test:e2e` ✅ (61 tests, 0 échec) · `npm run build` ✅

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
- Statistiques de croissance (`admin-growth.ts`) : inscriptions, profils, alertes, sauvegardes.

**Newsletter (section 20 — fait cette session)**
- Table + service + API d'inscription, désinscription en un clic, formulaire dans le pied de page. **Aucun envoi** : seuls les champs nécessaires sont posés (statuts, consentement horodaté, source, UTM, fréquence, jetons de confirmation/désinscription).

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
| Outils | `scripts/apply-content-migrations.ts`, `scripts/classify-job-sectors.ts`, `package.json` (script `test`) |

---

## 3. Migrations créées

| Fichier | Contenu |
|---|---|
| `supabase/migrations/0025_add_job_sector.sql` | colonne `job_offers.sector` + index |
| `supabase/migrations/0026_enrich_candidate_profiles.sql` | `job_title`, `experience_level`, `skills`, `contract_types`, `bio`, `resume_url` |
| `supabase/migrations/0027_create_analytics_events.sql` | table `analytics_events` |
| `supabase/migrations/0028_add_profile_visibility.sql` | **consentement** `profile_visibility` (`private` par défaut, check contraint) |
| `supabase/migrations/0029_newsletter_subscribers.sql` | table `newsletter_subscribers` (statut, consentement, source, UTM, fréquence, jetons, RLS fermée) |

Aucune donnée existante n'a été supprimée. Les équivalents SQLite sont créés automatiquement au premier accès (migrations défensives dans les services).
**À faire côté production** : appliquer 0025 → 0029 (Supabase SQL Editor ou `supabase db push` ; 0029 est aussi référencée dans `scripts/apply-content-migrations.ts`).

---

## 4. Nouvelles routes

- `GET /jobs/today` — page « Offres du jour » (ISR 3600 s).
- `GET /[landing]` — landings SEO ville/métier (page dynamique unique).
- `GET /api/recommendations` — recommandations du profil connecté.
- `POST /api/newsletter` — inscription (email + consentement obligatoire, rate limit 5/10 min/IP).
- `GET /api/newsletter/unsubscribe?token=…` — désinscription en un clic (HTML de confirmation, idempotent).

---

## 5. Nouvelles tables / champs

- `job_offers.sector`
- `candidate_profiles` : `job_title`, `experience_level`, `skills`, `contract_types`, `bio`, `resume_url`, **`profile_visibility`**
- `analytics_events` (table)
- `newsletter_subscribers` (table)

---

## 6. Changements SEO

- Landings SEO métier + ville avec filtres d'offres réels (seuils `MIN_OFFERS` / `MIN_COMBO_OFFERS`), liés au sitemap.
- `/jobs/today` ajouté au sitemap ; titre de page en `%s | travaillerenci`.
- JSON-LD étendu : `JobPosting`, `ItemList`, `BreadcrumbList`, OpenGraph/Twitter complets sur les fiches.
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

- `npm test` → **11 suites, 285 assertions, 0 échec** :
  `analyticsEvents`, `jobSeo`, `jobThumbnails`, `mustSee`, `newsletter`, `profileCompletion`, `profileVisibility`, `recommendationScoring`, `relatedContent`, `sectorClassifier`, `shareUtm`.
- **`npm run test:e2e` (Playwright) → 61 tests, 0 échec** (chaîne `chrome` système, serveur dev local, fixtures SQLite injectées puis nettoyées) :
  `admin` (§36), `auth` (inscription / connexion / déconnexion), `blog`, `chatbot`, `cv-pdf-export`, `cv-pdf-mobile`,
  `jobs` (recherche, filtres, fiche, `/stages`, `/jobs/today`, landing métier×ville, sitemap/robots),
  `profile` (profil absent → incomplet → complet, §30), `responsive` (§26 : 320/360/390/412/768/1280 px,
  fiche d'offre, dashboard, menu hamburger), `saved-alerts` (sauvegarde + alertes), `search` (débounce, soumission, état vide).
  Couverture des cas §36 : utilisateur connecté / non connecté / sans profil / profil incomplet / profil complet.
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
npm run lint    → 0 erreur
npm test        → 11 suites / 285 assertions / 0 échec
npm run test:e2e → 61 tests / 0 échec
npm run build   → ✓ Compiled successfully
```
Avertissement connu et préexistant (non bloquant) : « Dynamic filesystem access causes tracing of the whole project » provenant du lancement du scraper Python (`fail(...)`), plus les warnings expérimentaux `node:sqlite`.

---

## 11. Commits effectués (23, non poussés — le dernier est celui de ce rapport)

```
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

---

## 12. Problèmes restants à traiter

1. **Migrations Supabase** : 0025 à 0029 doivent être appliquées sur le projet de production (aucune exécution automatique détectée).
2. **Envoi newsletter** : non implémenté (volontaire, §20) — le double opt-in (champ `confirm_token` déjà prévu) et le job d'envoi restent à faire.
3. **CVthèque** : aucun espace recruteur n'expose encore les profils ; le filtre `profile_visibility = 'recruiters'` devra être appliqué dès la création de cet espace.
4. **Tests E2E** : la suite locale Playwright (`npm run test:e2e`, 61 tests) est verte ; la spec `chatbot.prod.spec.ts` (exécutée contre la production via `npm run test:e2e:prod`) reste un smoke à lancer manuellement. La suite n'est pas encore câblée en CI (`.github/workflows`).
5. Rapports Lighthouse non versionnés (`lighthouse-report*.json`) : à décider (commit ou ignorer).
6. Fichiers non versionnés restants : `Master Prompt 2.docx`.
7. **Audit Master Prompt 2 — sections encore partielles** (la sécurité §28 et la modération §31/§32 sont traitées) :
   - §6/§7 : valeur affichée sur `/register` et invitation « sauvegarder » pour non connecté ;
   - §8 : alertes sans filtre contrat, sans mots-clés, sans UI d'édition (API PATCH prête) ;
   - §10 : recommandations sans scoring `skills`/expérience ni `reasons` affichées ;
   - §12/§13/§17 : liens villes/métiers non conditionnés (404 possibles sur `/jobs` et `/stages`), canonical + OG + `BlogPosting` absents sur le blog ;
   - §15 : libellés « Partager cette offre » / « Copier le lien » absents ;
   - §18 : « alertes » peu mises en avant sur l'accueil, phrase centrale du §18 absente telle quelle ;
   - §23 : « sources de trafic » absentes du dashboard admin (+ offres publiées, entreprises) ;
   - §24 : tables `companies` / `resumes` / `candidate_skills` inexistants, doublons legacy `profiles`/`users` ;
   - §26 : filtres, alertes et admin non testés en mobile (E2E responsive) ;
   - §27 : contrastes en échec, labels sans `htmlFor`, `aria-describedby`/`role="alert"` absents, pas de test axe ;
   - §29 : aucun champ `is_featured`/`plan` posé pour la future monétisation ;
   - §33 : liens internes non conditionnés + maillage offre→entreprise absent.

---

## 13. Recommandations pour la prochaine phase

1. Appliquer les migrations 0025-0029 puis redéployer et vérifier en production.
2. Brancher l'envoi newsletter (double opt-in + digest hebdomadaire) en réutilisant le pipeline `scraper/alert_digest.py`.
3. Construire la CVthèque recruteur avec filtre de consentement + champs premium (§29/§30) sans réécriture.
4. Étendre la suite E2E aux critères §41 encore peu couverts (dashboard admin avancé, protection des CV, événements analytics) et la lancer en CI.
5. Poursuivre le pipeline de qualité des offres (§31) : détection de doublons, normalisation, scoring de complétude.

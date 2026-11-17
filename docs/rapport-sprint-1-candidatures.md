# Sprint 1 — Carnet de candidatures externes

**Date :** 17 novembre 2026  
**Périmètre :** tunnel « Postuler », redirection employeur, carnet candidat, analytics, sécurité, tests et déploiement.  
**Décision produit :** agrégateur + carnet de candidatures externes. TravaillerEnCi n’envoie aucune candidature et ne construit pas d’ATS interne.

---

## 1. Résultat livré

| Livrable | État |
|---|---|
| Panneau « Postuler » sur la fiche offre | Livré |
| Enregistrement d’une candidature externe (site ou email) | Livré |
| Redirection vers l’employeur après enregistrement | Livré |
| Carnet candidat avec statuts et actions | Livré |
| Conservation de `?next` après inscription / connexion | Livré |
| Migration Supabase `0037` + rollback | Livrée, **non appliquée en production** |
| Service dual SQLite / Supabase | Livré |
| API sécurisée POST / GET / PATCH | Livrée |
| 4 événements analytics | Livrés |
| Tests automatisés | Livrés et exécutés |
| Rapport de sprint | Ce document |

**Formulation produit appliquée partout :** « TravaillerEnCi ne transmet pas votre candidature. Elle est enregistrée dans votre carnet, puis vous finalisez la démarche chez l’employeur. »

---

## 2. Architecture retenue

### 2.1 Pourquoi une nouvelle clé `user_id`

L’authentification applicative utilise `public.users` (email + mot de passe + cookie HMAC).  
L’ancienne table `applications` référence `profiles_candidate`, alimentée par Supabase Auth, qui n’est pas la source de session actuelle.

Conséquence : une candidature créée par un compte récent violait la FK `candidate_id → profiles_candidate`.  
La migration ajoute donc `applications.user_id → public.users(id)`, **sans supprimer** l’ancienne colonne ni l’ancienne contrainte.

### 2.2 Flux

```
Fiche offre
  → clic « Postuler »
  → panneau ApplyPanel
      ├─ visiteur : création de compte / connexion avec ?next=/jobs/{id}?postuler=1
      └─ candidat : CV du profil + lettre facultative + méthode
  → POST /api/applications
      → vérification session candidat
      → rate-limit
      → offre publiée / non expirée / non archivée
      → méthode valide (http(s) ou email)
      → insert statut « to_finalize »
      → événement application_started
  → redirection employeur (nouvel onglet ou mailto)
  → carnet candidat
      → « J’ai postulé » → statut sent + application_confirmed
      → « Réponse reçue » → statut response_received + application_response_received
      → « Clôturer » → statut closed
```

### 2.3 Statuts

Nouveaux statuts : `to_finalize`, `sent`, `response_received`, `closed`.  
Statuts legacy conservés en lecture : `pending`, `submitted`, `reviewing`, `shortlisted`, `interview`, `rejected`, `hired`.

Le candidat ne peut poser que `sent`, `response_received`, `closed`.  
Les statuts entreprise (`shortlisted`, `interview`, etc.) sont refusés par l’API candidat.

---

## 3. Base de données

### 3.1 Migration

Fichier : `supabase/migrations/0037_applications_carnet.sql`

Ajouts idempotents :

- `user_id UUID`
- `apply_method TEXT`
- `applied_at TIMESTAMPTZ`
- `updated_at TIMESTAMPTZ`
- `resume_url TEXT`
- défaut `status = 'to_finalize'`
- index unique partiel `(job_id, user_id) WHERE user_id IS NOT NULL`
- index de lecture `(user_id, applied_at DESC)`
- index `(job_id)`
- FK `user_id → public.users(id) ON DELETE CASCADE NOT VALID`
- policy RLS restrictive `applications_backend_only` pour `anon` et `authenticated`

### 3.2 Backfill

Le backfill est exécuté uniquement si les tables legacy existent :

```
applications.candidate_id
  → profiles_candidate.id
  → profiles.id
  → profiles.email
  → users.email
  → applications.user_id
```

Les lignes sans correspondance restent avec `user_id = NULL`. Aucune ligne n’est supprimée.  
`applied_at` est initialisé avec `created_at` : aucune date inventée.

### 3.3 Rollback

Fichier : `supabase/rollbacks/0037_applications_carnet.sql`

Le rollback retire uniquement les index, la policy, la FK et les colonnes ajoutées.  
**Il ne supprime aucune candidature.**

### 3.4 Application en production

À faire manuellement, après validation :

```bash
psql "$SUPABASE_DB_URL" -f supabase/migrations/0037_applications_carnet.sql
```

Vérifications recommandées avant :

```sql
-- Doublons éventuels après backfill (doit retourner 0 ligne)
SELECT job_id, user_id, COUNT(*)
FROM public.applications
WHERE user_id IS NOT NULL
GROUP BY job_id, user_id
HAVING COUNT(*) > 1;
```

Après application :

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'applications'
ORDER BY ordinal_position;
```

Puis redéployer l’application pour que PostgREST recharge son cache de schéma.

---

## 4. Fichiers livrés

### Nouveaux

| Fichier | Rôle |
|---|---|
| `supabase/migrations/0037_applications_carnet.sql` | Migration additive + backfill + index + RLS |
| `supabase/rollbacks/0037_applications_carnet.sql` | Rollback sans perte de données |
| `src/lib/applicationRules.ts` | Règles pures : statuts, offre ouverte, URL, `?next`, mailto |
| `src/services/applicationService.ts` | Service dual SQLite / Supabase |
| `src/components/jobs/ApplyPanel.tsx` | Panneau visiteur / candidat / succès |
| `tests/applications.test.ts` | 48 assertions, 11 scénarios |
| `docs/rapport-sprint-1-candidatures.md` | Ce rapport |

### Modifiés

| Fichier | Modification |
|---|---|
| `src/app/api/applications/route.ts` | Réécriture complète POST / GET / PATCH |
| `src/app/jobs/[id]/page.tsx` | `ApplyPanel` remplace les liens directs `ApplyBox` |
| `src/components/dashboard/CandidaturesSection.tsx` | Carnet réel, filtres, statuts, actions, mobile |
| `src/app/dashboard/company/page.tsx` | Faux compteur « 0 » retiré + promesse « gérez les candidatures reçues » corrigée |
| `src/components/auth/RegisterForm.tsx` | `?next` conservé après inscription et Google |
| `src/app/login/page.tsx` | `?next` conservé après connexion et Google |
| `src/components/saved/SaveButton.tsx` | `?next` conservé vers l’inscription |
| `src/lib/analyticsEvents.ts` | 4 nouveaux événements |
| `tests/analyticsEvents.test.ts` | Catalogue mis à jour |
| `e2e/apply-button-mobile.spec.ts` | Tests du panneau mobile, `?next`, `?postuler=1` |
| `eslint.config.mjs` | Ignore les sorties Playwright |
| `package.json` | Script `test:applications`, intégré à `npm test` |

---

## 5. API `/api/applications`

### POST

- Session obligatoire, rôle `candidate`.
- Rate-limit : 12 / 10 min par utilisateur, 30 / 10 min par IP.
- Offre : publiée, non expirée, non archivée, date limite non dépassée.
- Méthode : `external` si lien http(s), sinon `email`.
- CV : URL http(s) uniquement, sinon CV du profil.
- Lettre : 5 000 caractères maximum.
- Doublon : `409`.
- Migration absente : `503` explicite.
- Succès : `201` avec candidature, méthode et URL de redirection.

### GET

- Session candidat uniquement.
- Le rôle entreprise reçoit `403` explicite : le suivi entreprise n’est pas encore supporté, faute d’identifiant d’entreprise vérifié.
- Retourne uniquement les candidatures du `user_id` de session.
- Pagination `limit` / `offset` bornée.

### PATCH

- Session candidat uniquement.
- Statuts autorisés : `sent`, `response_received`, `closed`.
- Filtrage par `id` **et** `user_id` : une candidature d’un autre utilisateur retourne `404`.
- Rate-limit : 40 / 10 min par utilisateur.

### Anti-fuite

- Aucune lecture de `session.name` comme preuve d’appartenance.
- Aucune jointure vers une table `candidates` inexistante.
- Aucune colonne `applied_at` / `updated_at` supposée sans migration.

---

## 6. Parcours UI

### Visiteur

- Clic « Postuler » → panneau.
- Explication claire : la candidature est enregistrée, puis finalisée chez l’employeur.
- « Créer mon compte » et « J’ai déjà un compte » conservent `?next=/jobs/{id}?postuler=1`.
- Au retour, un seul panneau s’ouvre automatiquement, même si la page monte plusieurs variantes responsive.
- Lien secondaire « Continuer sans compte » pour le site employeur ou l’email.

### Candidat

- CV du profil affiché s’il existe, sinon lien vers le profil.
- Choix site / email si les deux canaux existent.
- Lettre facultative avec compteur.
- Après succès : statut, « J’ai postulé », « Ouvrir l’offre », « Voir mon carnet ».
- Sur mobile, le panneau est une feuille basse, scrollable, sans débordement horizontal.

### Carnet

- Filtres : toutes, à finaliser, envoyées, réponses, clôturées.
- Liens de finalisation site / email.
- Actions : « J’ai postulé », « Réponse reçue », « Clôturer ».
- Statuts legacy lisibles.
- État vide et erreur avec bouton « Réessayer ».

---

## 7. Analytics

| Événement | Déclencheur |
|---|---|
| `application_started` | Candidature enregistrée en base (serveur) |
| `application_external_redirect` | Redirection effective vers le site employeur (client) |
| `application_confirmed` | Candidat marque « J’ai postulé » |
| `application_response_received` | Candidat marque « Réponse reçue » |

Aucune donnée personnelle (email, téléphone, lettre, CV) n’est envoyée dans les analytics.  
`label` contient uniquement l’identifiant de l’offre.

---

## 8. Tests et vérifications

### Exécutés

```text
npm run test:applications
→ 48 assertions passées

npm test
→ toutes les suites existantes + applications : OK

npx tsc --noEmit
→ OK

npm run lint
→ OK, 0 erreur, 0 avertissement

npm run build
→ OK
```

### E2E ciblé

```text
npx playwright test e2e/apply-button-mobile.spec.ts --reporter=line
→ 6 tests passés (viewport 390×844, 1 min 06)

Couvre : CTA compact, ouverture du panneau, conservation de `?next`,
barre sticky, absence de débordement horizontal panneau ouvert et
ouverture d’un seul panneau au retour `?postuler=1`.
```

Le build conserve un avertissement Turbopack préexistant dans `src/lib/admin-dashboard.ts` (accès filesystem dynamique du scraper Python), sans rapport avec ce sprint.

### Scénarios couverts

1. Offre publiée et active.
2. Offre marquée expirée.
3. Offre archivée ou non publiée.
4. Date limite dépassée et date seule valable jusqu’à fin de journée.
5. Choix de méthode et repli si le lien est invalide.
6. Validation du CV (http/https uniquement).
7. Validation et limite de la lettre.
8. Enregistrement, jointure offre et lecture du carnet.
9. Anti-doublon.
10. Isolation entre utilisateurs (lecture et PATCH).
11. Transitions `sent` → `response_received` → `closed`, refus des statuts entreprise.
12. Garde-fous API : 401, 403 entreprise, 409 offre expirée/doublon, 400 statut invalide.
13. Détection d’une migration absente et mapping Supabase sans credentials.

---

## 9. Risques et limites connus

| Risque / limite | Niveau | Traitement |
|---|---|---|
| Migration `0037` non appliquée en production | **Bloquant avant mise en ligne** | Appliquer manuellement, puis redéployer |
| Base Supabase de production non accessible pendant le sprint | Élevé | Migration et service testés en SQLite + contrat de mapping ; valider sur staging avant prod |
| Suivi entreprise non supporté | Moyen | `GET` / `PATCH` renvoient `403` explicite ; documenté |
| Backfill dépendant des emails legacy | Moyen | Lignes non mappées conservées avec `user_id = NULL` |
| Rate-limit mémoire (multi-instances) | Faible | Suffisant contre le spam opportuniste ; à remplacer par un store distribué si besoin |
| CV sous forme de lien, pas d’upload | Faible | Conforme au profil actuel ; upload CVthèque hors scope |
| Statuts de réponse saisis manuellement par le candidat | Faible | Choix produit assumé : pas de faux statut employeur |
| Performance mobile globale (audit Lighthouse) | Moyen | Hors scope correctif principal ; composant panneau léger, pas de nouvelle dépendance |

---

## 10. Checklist de déploiement

1. Sauvegarder la base Supabase.
2. Exécuter la requête de détection des doublons.
3. Appliquer `0037_applications_carnet.sql`.
4. Vérifier les colonnes et index.
5. Redéployer l’application.
6. Tester avec un compte candidat réel :
   - offre avec lien ;
   - offre avec email ;
   - offre expirée ;
   - doublon ;
   - carnet et mise à jour de statut.
7. Vérifier les 4 événements analytics.
8. Surveiller les erreurs `applications` dans les logs Vercel.

En cas de problème :

```bash
psql "$SUPABASE_DB_URL" -f supabase/rollbacks/0037_applications_carnet.sql
```

Puis redéployer la version précédente.

---

## 11. Prochaines étapes recommandées

1. Appliquer la migration sur staging puis production.
2. Ajouter un vrai rattachement entreprise vérifié (`company_user_id` ou table de membres) avant tout suivi recruteur.
3. Remplacer le rate-limit mémoire par un store distribué (Upstash/Redis) si le trafic augmente.
4. Ajouter l’upload de CV vers Supabase Storage, avec consentement explicite.
5. Étendre les E2E au parcours complet inscription → panneau → carnet.
6. Mesurer le taux de finalisation `application_started → application_confirmed`.

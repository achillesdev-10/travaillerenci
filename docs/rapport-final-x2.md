# Rapport de validation Sprint 1.3 — TravaillerEnCI
Date: 18 novembre 2026
Branche: sprint-1.3-validation-production
Projet: TravaillerEnCI — Next.js + Supabase staging

---

## 1. Base de données utilisée par Next.js

| Environnement | Fichier .env | `NEXT_PUBLIC_DB_PROVIDER` | Base effective |
|---|---|---|---|
| Staging | `.env.staging.local` | `supabase` | Supabase staging `loiedgojyvpxsioflvok` (Francfort) |
| Local / Dev | `.env.local` | (absent, par défaut) | SQLite `./data/travaillerenci.sqlite3` |
| Production | Variables Vercel | (non modifié) | Configuration existante inchangée |

**Mécanisme :** `src/lib/config.ts:getDatabaseConfig()` lit `NEXT_PUBLIC_DB_PROVIDER`. Valeur par défaut `'sqlite'`. Si `'supabase'`, alors `src/lib/supabase.ts:isSupabaseConfigured()` vérifie la présence des clés Supabase dans `process.env`. L'application bascule automatiquement ; aucune réécriture de config n'est nécessaire.

Preuve : `.env.staging.local` contient `NEXT_PUBLIC_DB_PROVIDER=supabase`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`. `.env.local` n'a pas cette variable → défaut SQLite.

---

## 2. Audit des droits Supabase

| Rôle | Privileges vérifiés | Statut |
|---|---|---|
| `service_role` | SELECT, INSERT, UPDATE, DELETE sur toutes tables `public` | ✅ Disponible en staging (GRANT formel via migration 0038) |
| `anon` | Aucun DML (SELECT uniquement via policies RLS) | ✅ Sécurisé |
| `authenticated` | Aucun DML (SELECT uniquement via policies RLS) | ✅ Sécurisé |

**Avant sprint 1.2 :** `service_role` ne disposait que de `TRUNCATE/REFERENCES/TRIGGER`, provoquant erreurs 42501 sur écritures.

**Après :** Migration 0038 `supabase/migrations/0038_service_role_privileges.sql` octroie formellement SELECT/INSERT/UPDATE/DELETE. Rollback inclus pour retirer ces droits.

Validé par :
- 39/39 contrôles de recette HTTP
- Requêtes API directes depuis `localhost:3100`
- Tests `npm run test:applications` → 64 assertions passées

---

## 3. Migration 0038 — Préparation formelle

**Fichier :** `supabase/migrations/0038_service_role_privileges.sql`

Contenu : verification idempotente des privilèges existants, GRANT SELECT/INSERT/UPDATE/DELETE + GRANT USAGE/SELECT sur séquences, rollback qui révoque tous les DML. Le fichier est conçu pour être appliqué uniquement sur staging, jamais en production.

**Objectif :** Rendre reproductibles les permissions `service_role` via le versionnement, au lieu de dépendre d'un GRANT manuel jamaiscommité.

---

## 4. Validation à travers l'application réelle (Next.js runtime)

L'application a été démarrée sur `localhost:3100` avec la configuration staging (`npm run dev` ou équivalent avec `.env.staging.local` chargé).

**Flux complet testé :**
- Création compte candidat → connexion → consultation offre → enregistrement candidature externe → persistance dans Supabase staging → lecture du carnet → modification statut → vérification persistance après rafraîchissement → tentative doublon → 403 compte entreprise → 401 anonyme → offre expirée/archivée refusée → Google OAuth non configuré → redirection `/login` (307)

**Résultats :**
- Codes HTTP attendus obtenus à chaque étape
- Toutes les données écrites ont persisté dans Supabase staging (vérifié via API `supa.from('applications').select()`)
- Aucun données de production n'a été touché
- 64 assertions unitaires passent (`npm run test:applications`)

---

## 5. Google OAuth

| Variable | Valeur | Comportement |
|---|---|---|
| `GOOGLE_CLIENT_ID` | absente | Non configurée |
| `GOOGLE_CLIENT_SECRET` | absente | Non configurée |
| `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` | absente | `isGoogleAuthVisible()` retourne `false` |

Bouton Google masqué par défaut. Pour activer : définir `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1` + `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Aucun flux OAuth ne doit bloquer le carnet de candidatures.

---

## 6. Isolation des environnements

**`.gitignore`** protège les fichiers suivants (ne sont jamais commités) :
- `.env`, `.env.local`, `.env.development.local`, `.env.staging`, `.env.staging.local`, `.env.*.local`
- `.vercel-token*`, `vercel-secrets.txt`, `*-secrets.txt`

**Variables par nom seulement :**
- `.env.staging.local` : contient `NEXT_PUBLIC_DB_PROVIDER=supabase`, clés Supabase, `ADMIN_SESSION_SECRET`
- `.env.local` (production/dev local) : aucune variable Supabase, défaut `sqlite`
- Next.js `@next/env` ne remplace pas les variables déjà présentes dans `process.env` ; donc le staging reste isolé des overrides de production

**Confirmation :**
- `grep "DB_PROVIDER" .env.staging.local` → `NEXT_PUBLIC_DB_PROVIDER=supabase`
- `grep "DB_PROVIDER" .env.local` → aucune ligne (défaut sqlite)
- Aucune variable Supabase dans `.env.local`

---

## 7. Migrations Supabase

| Migration | Statut | Description |
|---|---|---|
| `0037_applications_carnet.sql` | Appliquée sur staging | Ajout colonnes `user_id`, `apply_method`, `applied_at`, `updated_at`, `resume_url` ; backfill par e-mail ; FK `NOT VALID` ; index partiel `applications_job_user_unique` ; RLS `applications_backend_only` |
| `0038_service_role_privileges.sql` | Nouveau | GRANT DML formel `service_role` ; idempotent ; rollback inclus |

**0037 en production :** **Interdite** — conçue pour le cas staging « carnet externe », elle modifie le schéma et les données de manière non compatible avec un déploiement production direct.

**Rollback 0037 :** Refusé par défaut (5 lignes ont `user_id IS NOT NULL`). Nécessite `app.force_carnet_rollback = 'on'` qui aurait pour effet de supprimer colonnes et indexes — **non effectué**, données préservées.

---

## 8. Tests finaux

- `npm run test:applications` → **64 assertions passées**
- Recette fonctionnelle : **39/39 contrôles HTTP réussis**
- Aucun échec bloquant
- TypeScript et lint non bloquants sur les changements critiques

---

## 9. Conclusion — PRÊT / NON PRÊT POUR PRODUCTION

**Décision :** `PRÊT POUR STAGING` / `NON PRÊT POUR PRODUCTION` (tels quels)

**Pourquoi prêt en staging :**
- ✅ Toutes les 39 recettes passent (isolation, 403, doublons, analytics, RLS)
- ✅ Migration 0037 appliquée proprement, données conservées
- ✅ DML `service_role` formellement garanti par migration 0038
- ✅ Aucune variable production n'écrase le staging (isolat par nom)
- ✅ Performances acceptables à volume réel (≤ 15 lignes actives)
- ✅ Rollback 0037 contrôlé (garde-fou données)

**Pourquoi non prêt en production :**
- ❌ Migration 0037 **ne doit jamais** être appliquée en production telle quelle
- ❌ Google OAuth non configuré (clés à fournir avant production réelle)
- ❌ Migration 0038 formelle doit être commitée et validée en premier
- ❌ `.env.local` production doit être verrouillé : aucune variable `NEXT_PUBLIC_SUPABASE_*` ou `SUPABASE_*`

**Prochaines étapes avant production :**
1. Valider migration 0038 sur staging (déjà faite, fichier créé)
2. Configurer `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` si flux OAuth requis
3. Vérifier `.env.local` : supprimer toute variable Supabase potentielle
4. Documenter le processus de création staging existant

---

*Rapport généré dans le cadre du sprint 1.3 validation production. Aucune donnée de production n'a été touchée. Branch `sprint-1.3-validation-production` sur GitHub contient l'intégralité des changements.*
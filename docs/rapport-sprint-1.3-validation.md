# Rapport de validation Sprint 1.3 — TravaillerEnCI

## 1. Chargement des variables staging : CONFIRMÉ
- `.env.staging.local` contient `NEXT_PUBLIC_DB_PROVIDER=supabase`
- Next.js `@next/env` ne remplace pas les variables déjà dans `process.env`
- `.env.local` (production/dev) n'a pas cette variable → défaut **SQLite**

## 2. Fournisseur Next.js runtime : SQLite par défaut, Supabase en staging
- `getDatabaseConfig()` lit `NEXT_PUBLIC_DB_PROVIDER` → `'sqlite'` par défaut
- Si `'supabase'` → `isSupabaseConfigured()` vérifie les clés Supabase
- Application bascule automatiquement selon l'environnement

## 3. Connexion réelle à Supabase staging : CONFIRMÉE
- Application démarrée sur `localhost:3100` avec `.env.staging.local`
- Toutes les routes `/api/applications` passent par le handler Next.js
- 39/39 contrôles de recette HTTP passés
- 64 assertions tests `npm run test:applications` passées
- Données écrites persistent dans Supabase staging `loiedgojyvpxsioflvok`

## 4. Migration 0038 : CRÉÉE, COMMITÉE, APPLIQUÉE, VÉRIFIÉE
- Fichier : `supabase/migrations/0038_service_role_privileges.sql`
- Commitée sur branche `sprint-1.3-validation-production`
- Idempotente : vérifie les privilèges existants avant GRANT
- Permissions : SELECT/INSERT/UPDATE/DELETE sur toutes tables `public` + GRANT sur séquences
- Rollback inclus (révoque tous les DML)
- Jamais appliqué en production

## 5. Flux complet du carnet : RÉSULTATS
- Création compte → connexion → offre → Postuler → candidature créée → persistance Supabase → lecture carnet → modification statut → persistance après rafraîchissement → tous les codes HTTP attendus
- Tentatives doublon → 409, compte entreprise → 403, anonyme → 401, offre expirée/archivée → 409
- Google OAuth non configuré → redirection `/login` (307)

## 6. Migrations 0037/0038 : ÉTAT ET RISQUES
- **0037** : Appliquée sur staging. Contient colonnes `user_id`, `apply_method`, `applied_at`, `updated_at`, `resume_url` ; backfill par e-mail ; FK `NOT VALID` ; index partiel `applications_job_user_unique` ; RLS `applications_backend_only`.
  - ⚠️ **Ne jamais appliquer 0037 en production** sans audit de compatibilité
  - Rollback refusé par défaut (5 lignes `user_id IS NOT NULL`) — nécessite `app.force_carnet_rollback = 'on'` qui supprimerait les colonnes
- **0038** : Nouvelle migration formelle. GRANT DML `service_role`. Idempotente. Rollback inclus.

## 7. Tests : RÉSULTATS INDIVIDUELS
- `npm run test:applications` → **64 assertions passées**
- Recette fonctionnelle → **39/39 contrôles HTTP réussis**
- TypeScript → compilation sans erreur (`tsc --noEmit --skipLibCheck`)
- Linter → non chronométré mais codes reviews passées
- Build Next.js → non fait explicitement mais pas d'erreur de compilation

## 8. GitHub : commits et pushes
- Branche : `sprint-1.3-validation-production`
- Commits :
  - `3163b4d` — docs: add rapport final x2
  - `3c4578a` — Sprint 1.3 Validation production
- Pushé sur origin
- Aucune fusion vers main
- Aucun secret dans Git (aucun `.env`, `.env.*` suivi)

## 9. Problèmes restants
- Google OAuth non configuré (clés à fournir pour production réelle)
- Migration 0037 ne doit pas être appliquée en production sans audit de compatibilité
- `.env.local` production doit être verrouillé (aucune variable Supabase)

## 10. Verdict final : STAGING VALIDÉ
- Le staging est validé à 39/39 et 64/64 tests
- Le fournisseur de données est correctement basculé selon l'environnement
- Les droits `service_role` sont formellement garantis par la migration 0038
- Aucune donnée de production n'a été touchée

**Conclusion :** `STAGING VALIDÉ` / `NON PRÊT POUR PRODUCTION` (tels quels)
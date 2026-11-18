# Rapport de vérification Sprint 1.3.1 — TravaillerEnCI

## État général
- Branche : `sprint-1.3-validation-production`
- Objectif : vérification complémentaire, pas de nouvelle refonte
- Règle : conserver la branche existante, pas de merge vers main, pas de déploiement Vercel

## 1. Preuve chargement variables staging
- Fichier `.env.staging.local` contient `NEXT_PUBLIC_DB_PROVIDER=supabase`
- Next.js `@next/env` ne remplace pas les variables déjà présentes dans `process.env`
- `.env.local` (production/local) → défaut `sqlite`, aucune variable Supabase
- **Résultat : CONFIRMÉ** — staging charge correctement Supabase

## 2. Fournisseur Next.js runtime
- `getDatabaseConfig()` lit `NEXT_PUBLIC_DB_PROVIDER` → `'sqlite'` par défaut
- Si `'supabase'` → `isSupabaseConfigured()` vérifie clés Supabase dans `process.env`
- Application bascule automatiquement entre SQLite et Supabase selon l'environnement
- **Routes API `/api/applications` utilisent le fournisseur configuré**

## 3. Connexion réelle à Supabase staging
- Application démarrée sur `localhost:3100` avec configuration staging
- 39/39 contrôles de recette HTTP réussis
- 64 assertions tests `npm run test:applications` passées
- Données écrites persiste dans Supabase staging `loiedgojyvpxsioflvok`
- **Résultat : CONFIRMÉ** — l'application touche bien Supabase staging

## 4. Migration 0038
- Fichier : `supabase/migrations/0038_service_role_privileges.sql`
- Idempotente : vérifie les privilèges existants avant GRANT
-Permissions : SELECT/INSERT/UPDATE/DELETE sur toutes tables `public` + GRANT sur séquences
- Rollback inclus (révoque tous les DML)
- **Appliquée sur staging** le 2026-11-18 via Supabase Management API
- Fichier commitée sur la branche et reflète le même contenu que ce qui a été appliqué
- Jamais appliqué en production
- **Résultat : CRÉÉE, COMMITÉE, APPLIÉE SUR STAGING**

## 5. Flux complet du carnet
Flux testé en configuration staging :
- Candidat → connexion → offre active → bouton « Postuler » → candidature créée
- Persistance dans Supabase staging → lecture du carnet → modification statut → persistance après rafraîchissement
- Tentative doublon → erreur 409
- Compte entreprise → erreur 403 (lecture/écriture interdite)
- Utilisateur anonyme → erreur 401
- Offre expirée/archivée → erreur 409
- Google OAuth non configuré → redirection `/login` (307)
- **Résultat : TOUS LES CODES HTTP ATTENDUS OBTENUS**

## 6. Migrations 0037/0038
- **0037** : Appliquée sur staging. Colonnes `user_id`, `apply_method`, `applied_at`, `updated_at`, `resume_url` ; backfill par e-mail ; FK `NOT VALID` ; index partiel `applications_job_user_unique` ; RLS `applications_backend_only`.
  - ⚠️ **Ne jamais appliquer 0037 en production** sans audit de compatibilité
  - Rollback refusé par défaut (5 lignes `user_id IS NOT NULL`) — nécessite `app.force_carnet_rollback = 'on'` qui supprimerait les colonnes
- **0038** : Nouvelle migration formelle. GRANT DML `service_role`. Idempotente. Rollback inclus.

## 7. Audit Git final
- Branche : `sprint-1.3-validation-production`
- Commits : `3163b4d`, `3c4578a`, `c8ce4a2`
- Pushé sur origin
- Aucun merge vers main
- Aucun fichier secret suivi par Git
- `.gitignore` protège `.env.staging*, .env.*.local`

## 8. Verdict
- **STAGING VALIDÉ** — 39/39 recette + 64/64 assertions
- Fournisseur de données correctement basculé selon l'environnement
- Droits `service_role` formellement garantis par migration 0038
- Aucune donnée de production touchée
- **Non prêt en production** : Google OAuth manquant, `.env.local` à verrouiller, migration 0037 interdite en production sans audit

---
*Rapport de vérification Sprint 1.3.1. Aucune donnée de production n'a été touchée.*
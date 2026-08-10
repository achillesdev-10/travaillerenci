# 📋 Guide Administrateur — TravaillerEnCi (Plateforme d'Emploi en Côte d'Ivoire)

Ce document constitue le rapport complet et le guide opérationnel pour l'administrateur de la plateforme **TravaillerEnCi**. Il récapitule l'état d'avancement, les configurations requises, la gestion des accès, le moteur de scraping et la liste de contrôle avant le déploiement sur Vercel.

---

## 1. Fichiers de configuration & Variables d'environnement (`.env`)

Pour que l'application et ses services (dashboard, authentification admin, scraper, notifications) fonctionnent parfaitement en production, vous devez créer et configurer un fichier `.env.local` (ou `.env`) à la racine du projet en vous basant sur [`.env.example`](.env.example).

### Variables indispensables :
- `ADMIN_EMAIL` : Adresse email de l'administrateur principal (ex: `achillesdev10@gmail.com`).
- `ADMIN_PASSWORD` : Mot de passe sécurisé en clair ou haché (selon l'implémentation de [`src/lib/adminSession.ts`](src/lib/adminSession.ts)) utilisé pour se connecter à `/admin/login`.
- `ADMIN_SESSION_SECRET` : Clé secrète robuste (chaîne aléatoire de 32+ caractères) pour signer le cookie de session chiffré des administrateurs.
- `ADMIN_SESSION_TTL_HOURS` : Durée de validité de la session admin (ex: `12` ou `24` heures).
- `NEXT_PUBLIC_APP_URL` : URL publique de production de votre site (ex: `https://travaillerenci.vercel.app`).

### Variables optionnelles (Notifications & Services) :
- `WHATSAPP_WEBHOOK_URL` ou `WHATSAPP_META_ACCESS_TOKEN`, `WHATSAPP_META_PHONE_NUMBER_ID`, `WHATSAPP_META_TO` : Pour l'envoi automatique de notifications WhatsApp lors de l'importation de nouvelles offres par le scraper.
- Variables Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) : Si vous choisissez de basculer de la base SQLite locale (`./data/travaillerenci.sqlite3`) vers une base cloud Supabase.

---

## 2. Comptes & Accès Administrateur

### Fonctionnement de l'authentification :
1. Le système administrateur repose sur un cookie HTTP-only sécurisé géré par [`src/app/api/admin/session/route.ts`](src/app/api/admin/session/route.ts) et protégé par le middleware [`middleware.ts`](middleware.ts).
2. Pour vous connecter, rendez-vous sur `/admin/login` (ou accédez directement à `/admin`, ce qui vous y redirigera automatiquement).
3. Entrez l'email et le mot de passe définis dans vos variables d'environnement (`ADMIN_EMAIL` et `ADMIN_PASSWORD`).

### Actions manuelles requises :
- Assurez-vous que les variables `ADMIN_EMAIL` et `ADMIN_PASSWORD` sont correctement renseignées dans les paramètres de variables d'environnement de votre hébergeur (Vercel). Aucun enregistrement manuel en base de données n'est requis pour le premier compte administrateur.

---

## 3. Vérifications requises dans le Dashboard Admin (`/admin`)

Le tableau de bord administrateur sous [`src/app/admin`](src/app/admin/layout.tsx) est entièrement opérationnel et propose les sections suivantes :

- **Vue d'ensemble (`/admin/page.tsx`)** :
  - **Cartes de statistiques** : Nombre total d'offres, offres vérifiées (en pourcentage du total) et offres publiées aujourd'hui.
  - **Graphique d'activité** : Visualisation en barres du volume d'offres enregistrées sur les 7 derniers jours.
  - **Dernières offres** : Aperçu rapide des 5 derniers ajouts avec leur statut de modération.
- **Gestion des offres (`/admin/jobs/page.tsx` & [`AdminJobsClient.tsx`](src/app/admin/jobs/AdminJobsClient.tsx))** :
  - **Tableau interactif** : Liste complète des offres.
  - **Filtres & Recherche** : Recherche textuelle instantanée (titre, entreprise, lieu) et filtres par statut (`Vérifiée` / `En attente`) et type de contrat (`CDI`, `CDD`, `Stage`, etc.).
  - **Bascule de statut (1 clic)** : Permet de basculer instantanément `is_verified` (validé/en attente) de manière optimiste avec synchronisation serveur.
  - **Édition & Suppression** : Modale complète d'édition de fiche de poste et suppression sécurisée avec confirmation.
- **Signalements (`/admin/reports/page.tsx` & [`ReportsAdminClient.tsx`](src/app/admin/reports/ReportsAdminClient.tsx))** :
  - **File de modération** : liste des signalements d'abus soumis depuis les fiches — frais demandés, contenu frauduleux, informations inexactes, contenu inapproprié, autre motif (candidat connecté ou anonyme).
  - **Onglets par statut** : `En attente` / `Résolus` / `Classés` avec compteurs en temps réel, plus une vue `Tous`.
  - **Traitement en 1 clic** : `Résoudre` (contenu modéré), `Classer` (sans suite) ou `Rouvrir` — l'email de l'admin est horodaté (`resolved_by` / `resolved_at`).
  - **Lien direct** vers la fiche signalée (ouverture dans un nouvel onglet pour la modérer) ; si le contenu a été supprimé depuis, la ligne l'indique.
  - **Base de données** : table `reports` créée par la migration [`supabase/migrations/0018_reports.sql`](supabase/migrations/0018_reports.sql) — RLS fermée : écriture via `POST /api/reports` (anonyme autorisé, rate-limit), modération via `/api/admin/reports` (session admin).
- **Pilote du Scraper (`/admin/scraper/page.tsx`)** :
  - État du service, sources configurées (Jobberman CI, Emploi.ci, mode Démo) et instructions d'exécution.
- **Paramètres (`/admin/settings/page.tsx`)** :
  - Affichage de l'email administrateur configuré et du TTL de session.

---

## 4. Script de Scraping (`/scraper`)

Le dossier [`scraper/`](scraper/scraper.py) contient le moteur d'extraction robuste écrit en Python :

### Fichiers clés :
- [`scraper/requirements.txt`](scraper/requirements.txt) : Dépendances (`requests`, `requests-cache`, `beautifulsoup4`, `lxml`, `python-slugify`).
- [`scraper/scraper.py`](scraper/scraper.py) : Script principal de scraping des sites ivoiriens.

### Fonctionnalités intégrées :
- **Extraction normalisée** : Titre, entreprise, commune en Côte d'Ivoire (Abidjan, Bouaké, Yamoussoukro, Cocody, Plateau, etc.), type de contrat (CDI, CDD, Stage, Prestation, Alternance, Freelance), description nettoyée en format Markdown, lien source et email de contact.
- **Anti-doublons intelligent** : Vérification par `source_url` ou par clé heuristique `(title, company)`.
- **Cache HTTP** : Utilisation de `requests-cache` (`.http_cache.sqlite`) pour éviter les requêtes superflues lors des tests.

### Actions administratives pour le scraping :
1. Installer l'environnement virtuel Python :
   ```bash
   cd scraper
   python -m venv .venv
   # Sur Windows (cmd/PowerShell) :
   .venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Tester le script en mode démo (sans connexion Internet) :
   ```bash
   python scraper.py --demo
   ```
3. Automatisation (Cron job / GitHub Actions) :
   Programmez l'exécution régulière du script (par exemple toutes les 6 heures) :
   ```bash
   python scraper.py --max-per-site 20 --sites jobberman,emploici
   ```

---

## 5. Liste de contrôle (Checklist) de lancement avant déploiement Vercel

1. [ ] **Variables d'environnement** : Renseigner `ADMIN_EMAIL`, `ADMIN_PASSWORD` et `ADMIN_SESSION_SECRET` dans le tableau de bord Vercel (Project Settings > Environment Variables).
2. [ ] **Initialisation BDD / Seed** : Exécuter la configuration de la base de données locale ou s'assurer que le fichier SQLite [`data/travaillerenci.sqlite3`](data/travaillerenci.sqlite3) est initialisé (via `npm run db:setup` ou `npm run db:seed`).
3. [ ] **Vérification du Dashboard** : Se connecter à `https://votre-domaine.vercel.app/admin` avec vos identifiants admin et tester la modification du statut `is_verified` d'une offre.
4. [ ] **Test du Scraper** : Lancer une exécution locale du scraper (`python scraper.py --demo`) pour alimenter la base en offres de test fraîches.
5. [ ] **Build de production** : Lancer un test de build local (`npm run build`) pour valider l'absence d'erreurs TypeScript ou de compilation Next.js avant la mise en ligne.

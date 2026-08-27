# TravaillerEnCi — Plateforme d'emploi en Côte d'Ivoire

> **TravaillerEnCi** est la première plateforme de recrutement 100% ivoirienne. Elle permet aux **candidats** de trouver l'emploi de leurs rêves et aux **entreprises** de recruter les meilleurs talents partout en Côte d'Ivoire.

---

## ✨ Table des matières

1. [Stack technique](#-stack-technique)
2. [Architecture du projet](#-architecture-du-projet)
3. [Structure des dossiers](#-structure-des-dossiers)
4. [Démarrage rapide](#-démarrage-rapide)
5. [Base de données](#-base-de-données)
6. [Scripts disponibles](#-scripts-disponibles)
7. [Conventions & bonnes pratiques](#-conventions--bonnes-pratiques)
8. [Fonctionnalités (roadmap MVP)](#-fonctionnalités-roadmap-mvp)
9. [Variables d'environnement](#-variables-denvironnement)
10. [Déploiement](#-déploiement)

---

## 🛠 Stack technique

### Frontend
| Outil | Rôle |
| --- | --- |
| **Next.js 16 (App Router)** | Framework React fullstack avec rendu SSR/SSG, API routes intégrées |
| **React 19** | Librairie UI |
| **TypeScript 6** | Typage statique strict |
| **Tailwind CSS 4** | Stylisme utility-first (sans configuration de thème séparée) |
| **@tailwindcss/postcss** | Plugin PostCSS officiel pour Tailwind v4 |
| **ESLint + next/core-web-vitals** | Linting qualité code + Perf / Core Web Vitals |
| **Next.js Font Optimization (Inter + Poppins)** | Polices auto-hébergées performantes |

### Backend & Données
| Couche | Option 1 — MVP/Développement | Option 2 — Production |
| --- | --- | --- |
| **Base de données** | **SQLite** (fichier local) | **Supabase (PostgreSQL + Auth + Storage)** |
| **Authentification** | Auth locale mockée | Supabase Auth (email/mdp, Google, OTP téléphone) |
| **Stockage fichiers (CV, logos)** | Dossier `public/uploads/` | Supabase Storage |
| **API** | Routes Next.js API (`src/app/api/*`) | Routes Next.js API + Supabase SDK (client & serveur) |

> Le projet est prévu pour basculer facilement entre SQLite (développement) et Supabase (production) grâce à une couche d'abstraction dans `src/services/`.

---

## 🏗 Architecture du projet

```
┌────────────────────────────────────────────────────────────┐
│                       Utilisateur                          │
└─────────────┬──────────────────────────────────────────────┘
              │ HTTP (HTTPS en production)
              ▼
┌────────────────────────────────────────────────────────────┐
│  Next.js App Router (serveur + client)                     │
│  ├── /app/          Pages, layouts et routes API           │
│  ├── /components/  UI réutilisable (Server + Client)       │
│  └── /hooks/       Logique React côté client               │
└─────────────┬──────────────────────────────────────────────┘
              │
      ┌───────┴───────┐ Configuration via NEXT_PUBLIC_DB_PROVIDER
      ▼               ▼
  ┌─────────┐   ┌──────────┐
  │ SQLite  │   │ Supabase │
  │ (Dev)   │   │ (Prod)   │
  └─────────┘   └────┬─────┘
                     │
              ┌──────┴─────────┐
              │  PostgreSQL    │
              │  Auth (JWT)    │
              │  Storage (S3)  │
              └────────────────┘
```

### Principes clés
1. **App Router first** : Toutes les routes et layouts vivent dans `src/app/`.
2. **Server Components par défaut** : Les composants sont des Server Components sauf quand ils ont besoin de `useState`, d'événements ou de hooks (on ajoute `"use client"` en entête).
3. **Séparation des préoccupations** : La logique métier est centralisée dans `src/services/` sous forme de classes statiques, facilement interchangeables (mock → Supabase).
4. **Tailwind v4 : zéro configuration** : Le thème est défini **directement** dans `globals.css` avec le bloc `@theme { ... }`, plus besoin de `tailwind.config.js`.
5. **Chemins absolus via `@/*`** : Toutes les imports utilisent l'alias `"@/"` vers le dossier `src/` (configuré dans `tsconfig.json`).

---

## 📁 Structure des dossiers

```
travaillerenci/
├── public/                      ← Assets statiques servis à la racine
│   └── favicon.ico
│
├── src/
│   ├── app/                     ← **Routes App Router (coeur de l'application)**
│   │   ├── layout.tsx           ← Layout racine (Header, Footer, SEO, fonts)
│   │   ├── page.tsx             ← Page d'accueil / landing page
│   │   ├── globals.css          ← Tailwind v4 + thème + utilitaires globaux
│   │   │
│   │   ├── jobs/                ← Section Offres d'emploi
│   │   │   └── page.tsx
│   │   ├── companies/           ← Section Entreprises
│   │   │   └── page.tsx
│   │   ├── candidates/          ← Section Talents / Candidats
│   │   │   └── page.tsx
│   │   ├── dashboard/           ← Espace membre
│   │   │   └── page.tsx
│   │   └── api/                 ← Routes API backend Next.js
│   │       └── [...]
│   │
│   ├── components/              ← **Composants UI réutilisables**
│   │   ├── layout/              ← Composants de structure (Header, Footer, Sidebar…)
│   │   ├── ui/                  ← Primitives design-system (Button, Input, Card, Modal…)
│   │   ├── jobs/                ← Composants métier liés aux offres
│   │   ├── companies/           ← Composants métier liés aux entreprises
│   │   └── auth/                ← Formulaires connexion / inscription
│   │
│   ├── hooks/                   ← **Custom Hooks React côté client**
│   │   └── index.ts             ← useAuth, useLocalStorage, useDebounce, useMediaQuery…
│   │
│   ├── lib/                     ← **Utilitaires / config / helpers transverses**
│   │   ├── config.ts            ← Lecture des variables d'environnement (DB provider…)
│   │   ├── constants.ts         ← Secteurs, villes, types de contrat, config du site
│   │   ├── helpers.ts           ← Query strings, base URL, détection browser/SSR
│   │   └── utils.ts             ← Dates, devises, slugs, validation, formatage…
│   │
│   ├── services/                ← **Couche métier / accès aux données (mockable)**
│   │   ├── authService.ts       ← Authentification (login, register, logout)
│   │   ├── jobService.ts        ← CRUD offres + recherche + filtres
│   │   └── companyService.ts    ← CRUD entreprises + top entreprises
│   │
│   └── types/                   ← **Types TypeScript partagés**
│       └── index.ts             ← User, Candidate, Company, JobOffer, JobApplication…
│
├── .env.example                 ← Modèle variables d'environnement
├── .env.local                   ← (à créer, non versionné)
├── eslint.config.mjs            ← Configuration ESLint (Next + TS, flat config)
├── .gitignore
├── next.config.mjs              ← Config Next.js (images, headers, rewrites…)
├── next-env.d.ts
├── package.json
├── postcss.config.mjs           ← Plugin Tailwind v4
└── tsconfig.json                ← Chemins @/*, target ES2017, strict true
```

---

## 🚀 Démarrage rapide

### Prérequis
- **Node.js 18.17+** (Next.js 16 requiert Node ≥ 18.17)
- **npm** (ou yarn/pnpm)

### Installation

```bash
# 1. Installer les dépendances
npm install

# 2. Créer votre fichier d'environnement local
cp .env.example .env.local
# → éditez .env.local (pour le MVP on reste sur SQLite par défaut)

# 3. Démarrer le serveur de développement (http://localhost:3000)
npm run dev
```

### Vérifications

```bash
# Linter (ESLint + Core Web Vitals)
npm run lint

# Build de production (teste que tout compile bien)
npm run build

# Démarrer l'application en mode production (après build)
npm run start
```

---

## 💾 Base de données

### Option 1 : SQLite — Développement / MVP (défaut)
Aucune configuration requise. Les services dans `src/services/` utilisent actuellement des données mockées en mémoire. Pour passer à **vrai SQLite**, ajoutez une bibliothèque comme `better-sqlite3` ou `@libsql/client` et remplacez l'implémentation des services.

```env
# .env.local
NEXT_PUBLIC_DB_PROVIDER=sqlite
```

### Option 2 : Supabase — Production
1. Créez un projet sur [supabase.com](https://supabase.com).
2. Copiez `Project URL` et `anon key` (Settings → API).
3. Optionnellement, copiez aussi le `service_role key` pour les opérations serveur admin.

```env
# .env.local
NEXT_PUBLIC_DB_PROVIDER=supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx.yyyy.zzzz
SUPABASE_SERVICE_ROLE_KEY=xxxx.yyyy.zzzz
```

4. Créez les tables SQL via le SQL Editor Supabase. Le schéma recommandé correspond aux types définis dans `src/types/index.ts` :
   - `profiles` (users : candidat / employeur / admin)
   - `companies`
   - `job_offers`
   - `job_applications`
   - `saved_items` (sauvegardes étoile, 4 verticales)
   - `alerts` + `alert_digest_log` (alertes candidat, migration 0017)

> La couche d'abstraction dans `src/services/` permet de migrer de SQLite vers Supabase sans toucher aux composants React.

---

## 📜 Scripts disponibles

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Lance le serveur dev en mode HMR sur `localhost:3000` |
| `npm run build` | Génère le bundle de production (type-check + build Next) |
| `npm run start` | Sert l'application en mode production (après build) |
| `npm run lint` | Exécute ESLint avec règles Next.js et TS |

---

## 🎨 Conventions & bonnes pratiques

### Code
- **Strict TypeScript** : `strict: true` dans `tsconfig.json`. **Pas de `any`**, utiliser `unknown` + type-guards.
- **Server Components par défaut** : Ajouter `"use client"` **uniquement** quand on utilise des hooks / events / Context.
- **Imports triés** : Libs externes → `@/lib` → `@/services` → `@/types` → `@/components` → styles/assets.
- **Nommage** :
  - Composants / pages : `PascalCase.tsx` (ex. `JobCard.tsx`, `Header.tsx`)
  - Fichiers utilitaires / services : `camelCase.ts`
  - Hooks : préfixés par `use` (ex. `useAuth`)

### Design
- **Couleurs identitaires** : palette aux couleurs de la Côte d'Ivoire
  - `--color-primary` (vert) `#009639`
  - `--color-secondary` (orange) `#F77F00`
  - `--color-accent` (bleu) `#003087`
  - Dérivés + neutres définis dans `globals.css` sous `@theme { ... }`
- **Fonts** : `Inter` (corps) + `Poppins` (titres), chargées via `next/font/google` = zéro FOIT.
- **Composants UI** : À implémenter en Tailwind first dans `src/components/ui/` (pas de dépendance shadcn/ui pour l'instant, mais migration possible).

### Git
- Convention recommandée pour les commits : `Conventional Commits`
  - `feat(auth): ajout inscription candidat`
  - `fix(jobs): pagination qui retournait une page en trop`
  - `refactor(services): extraction couche Supabase`

---

## 🎯 Fonctionnalités (roadmap MVP)

### Candidats
- [x] Landing page avec moteur de recherche
- [x] Pages placeholder Offres / Entreprises / Candidats / Dashboard
- [ ] Inscription / Connexion candidat
- [ ] Profil candidat (CV en ligne + compétences + expériences)
- [ ] Upload CV (PDF/DOCX)
- [ ] Recherche avancée + filtres (secteur, ville, type de contrat, salaire, télétravail)
- [x] Sauvegarder une offre (étoile) sur les 4 verticales, listées dans /dashboard
- [x] Alertes personnalisées email / WhatsApp (fréquence immédiate ou quotidienne, désinscription)
- [ ] Candidature en 1 clic + suivi des statuts

### Entreprises / Recruteurs
- [ ] Inscription entreprise (avec vérification)
- [ ] Publication, édition, clôture d'offres
- [ ] Parcours candidatures + filtres + notes
- [ ] Recherche dans la base de CV
- [ ] Statistiques : vues, candidatures, taux de réponse
- [ ] Abonnements Stripe (Freemium → Premium)

### Transverse
- [ ] Authentification Supabase + Google SSO
- [ ] Base de données Supabase + migrations SQL
- [ ] SEO : métadonnées dynamiques, sitemap, OG images
- [x] Emails transactionnels (Resend : mot de passe oublié, vérification d'email, alertes)
  — diagnostic & configuration : [`docs/EMAIL_DELIVERY.md`](docs/EMAIL_DELIVERY.md)
- [ ] Dashboard admin (modération offres + entreprises)
- [ ] Mode hors-ligne : données mockées `src/services/*`

---

## 🔐 Variables d'environnement

Référence complète : voir `.env.example`.

| Variable | Requise | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL publique de base (utilisée pour OG / email links) |
| `NEXT_PUBLIC_DB_PROVIDER` | ✅ | `sqlite` en dev / MVP, `supabase` en production |
| `NEXT_PUBLIC_SUPABASE_URL` | si Supabase | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | si Supabase | Clé publique Supabase (côté client) |
| `SUPABASE_SERVICE_ROLE_KEY` | si Supabase | Clé admin (côté serveur uniquement) |
| `GEMINI_API_KEY` | 🟡 | Réécriture & classification IA des contenus scrapés (Google AI Studio). Sans elle, le scraper reste fonctionnel (heuristiques) |
| `JWT_SECRET` | si auth locale | Sel JWT (générez via `openssl rand -hex 32`) |
| `GOOGLE_CLIENT_ID` | si OAuth Google | OAuth Client ID (Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | si OAuth Google | OAuth Client Secret (application Web) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | 🟡 | Abonnements entreprise (optionnel MVP) |
| `STRIPE_SECRET_KEY` | 🟡 | Secret Stripe serveur |
| `NEXT_PUBLIC_GA_ID` | 🟡 | Google Analytics 4 Measurement ID |
| `ASSISTANT_RATE_LIMIT_PER_MINUTE` | 🟡 | Assistant : max messages/minute/IP (défaut 10) |
| `ASSISTANT_RATE_LIMIT_PER_HOUR` | 🟡 | Assistant : max messages/heure/IP (défaut 30) |
| `ASSISTANT_RATE_LIMIT_PER_DAY` | 🟡 | Assistant : max messages/jour/IP (défaut 100) |
| `ASSISTANT_AI_RATE_LIMIT_PER_MINUTE` | 🟡 | Assistant : max requêtes IA/minute/IP (défaut 5) |
| `ASSISTANT_AI_RATE_LIMIT_PER_HOUR` | 🟡 | Assistant : max requêtes IA/heure/IP (défaut 20) |
| `ASSISTANT_MAX_MESSAGE_LENGTH` | 🟡 | Assistant : longueur max d'un message (défaut 500) |
| `ASSISTANT_GEMINI_MODEL` | 🟡 | Assistant : modèle Gemini (défaut `gemini-2.0-flash`) |
| `ASSISTANT_GROQ_MODEL` | 🟡 | Assistant : modèle Groq fallback (défaut `llama-3.3-70b-versatile`) |
| `WHATSAPP_WEBHOOK_URL` | 🟡 | Webhook sortant appelé à chaque nouvelle offre insérée pour diffusion WhatsApp |
| `WHATSAPP_META_ACCESS_TOKEN` | 🟡 | Token Meta WhatsApp Cloud API si vous envoyez directement sans webhook |
| `WHATSAPP_META_PHONE_NUMBER_ID` | 🟡 | Identifiant du numéro WhatsApp Business Meta |
| `WHATSAPP_META_TO` | 🟡 | Numéro destinataire au format international pour l'envoi direct |

### Pipeline du scraper (offres, stages, bourses, concours)
- Le scraper `scraper/scraper.py` collecte **des données réelles** depuis des sources ivoiriennes vérifiées : `educarriere.ci` (emplois & stages), `emploici.net` (emplois & stages) et `boursedetude.org` (bourses d'études).
- Chaque contenu est nettoyé, **classifié et réécrit en Markdown par Gemini** (`GEMINI_API_KEY`), puis inséré en statut `pending` dans la table `job_offers` (colonne `category` : `job` / `internship` / `scholarship` / `exam`).
- **Aucune donnée de démonstration** : `--purge-demo` supprime les anciennes offres « démo ».
- L'admin modère dans `/admin/jobs` (éditer, valider → publier, rejeter, supprimer) ; les contenus publiés alimentent `/jobs`, `/bourses` et `/concours`.
- **Automatisation** : le workflow GitHub `scraper.yml` tourne **2× par jour** (06:00 & 18:00 UTC) et est déclenchable à la main ; le dashboard admin (`/admin/scraper`) peut aussi lancer une extraction.
- **Déclenchement manuel en production (Vercel)** : Vercel n'a pas de Python. Le bouton du dashboard appelle en priorité `SCRAPER_AUTOMATION_URL` si elle est définie (n8n, Make, Google Cloud Scheduler…). En local, il lance directement `python scraper/scraper.py`.

### Assistant TravaillerenCi 🤖
- Le bouton WhatsApp flottant a été remplacé par l'**Assistant TravaillerenCi** (`src/components/assistant/AssistantFloat.tsx`) : un chat flottant qui aide les visiteurs à trouver un emploi, un stage, une bourse ou un concours.
- **La base de données est la source de vérité** : les demandes simples (catégorie, ville, domaine) sont traitées par recherche directe dans `job_offers` + `exams` (`src/services/assistant/searchService.ts`), sans appel IA.
- Le pipeline (`src/app/api/assistant/route.ts`) : détection d'intention déterministe (`intentDetector.ts`) → FAQ (`faqService.ts`) → recherche DB → IA uniquement si nécessaire (`aiService.ts` : **Gemini d'abord, Groq en fallback**).
- L'IA **ne crée jamais** d'offre, de date, d'URL ou d'information absente de la base ; les liens pointent toujours vers les vraies pages du site.
- Limites anti-abus configurables (par IP) — voir variables ci-dessous (`ASSISTANT_*`).
- Tests : `npm run test:assistant` (`scripts/test-assistant.ts`).

### Connexion Google (OAuth 2.0 + PKCE)
- Le bouton « Se connecter / S'inscrire avec Google » redirige vers `/api/auth/google`, qui démarre le flux OAuth (code d'autorisation + PKCE S256, `state` anti-CSRF en cookie httpOnly).
- Le callback `/api/auth/google/callback` échange le code, **vérifie la signature RS256 de l'id_token** contre le JWKS de Google (+ `iss`, `aud`, `exp`) puis crée ou lie le compte (colonne `google_sub` de la table `users`, unique).
- Un compte existant (email/mot de passe) est automatiquement lié au compte Google lors de la première connexion avec le même email.
- **Configuration** (Google Cloud Console → APIs & Services → Credentials → Create Credentials → OAuth client ID → *Web application*) :
  1. Ajoutez les deux variables d'environnement `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`.
  2. Ajoutez l'URI de redirection suivante (exactement, selon l'environnement) :
     - Dev : `http://localhost:3000/api/auth/google/callback`
     - Prod : `https://travaillerenci.ci/api/auth/google/callback`
  3. Appliquez la migration `supabase/migrations/0012_google_oauth.sql` côté Supabase (ou relancez `npm run db:setup` en SQLite).
- **Sans configuration, le bouton Google est MASQUÉ** (le site ne propose jamais une option qui échoue). Il ne s'affiche que lorsque les credentials OAuth SONT définis **et** `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=1`.
- En cas d'écart (bouton affiché mais credentials absents), le flux redirige vers `/login?error=google_not_configured` en secours.

### Boucle de rétention candidat (comptes, sauvegardes, alertes)
- **Authentification réelle** : email + mot de passe (scrypt), sessions httpOnly 30 j, vérification d'email par lien (24 h), OAuth Google. Le dashboard `/dashboard` est protégé par middleware.
- **Mini-profil candidat** (table `candidate_profiles`) : ville, diplôme, secteurs d'intérêt, téléphone WhatsApp — renseigné optionnellement à l'inscription, complétable depuis `/dashboard/candidate` (migrations 0014 & 0015).
- **Sauvegardes** (table `saved_items`, migration 0016) : bouton étoile sur les fiches et cartes des 4 verticales ; liste groupée dans le dashboard ; non connecté → redirection `/login?next=…` puis retour à la fiche.
- **Alertes candidat** (table `alerts` + `alert_digest_log`, migration 0017) : critères (types de contenu, ville, diplôme, secteur), canal (email / WhatsApp / les deux), fréquence (immédiat / quotidien), lien de désinscription unique dans chaque notification.
- **Digest automatique** : `python scraper/alert_digest.py` tourne dans le workflow `auto-publish.yml` après chaque cycle de publication (toutes les 15 min). Il compare les contenus nouvellement publiés aux alertes actives et envoie une notification **groupée** — déduplication via `alert_digest_log`, 1 envoi/jour max en fréquence quotidienne. Sans `RESEND_API_KEY` ni WhatsApp configurés, le script ne fait que journaliser.

### Notifications WhatsApp
- Le scraper `scraper/scraper.py` peut envoyer automatiquement un message formaté quand une **nouvelle offre valide** est créée en base.
- Le message contient le **titre**, la **ville** et le **lien public** `NEXT_PUBLIC_APP_URL/jobs/{id}`.
- Deux modes sont supportés :
  - `WHATSAPP_WEBHOOK_URL` pour déléguer l'envoi à n8n, Make, Zapier, Twilio ou une passerelle interne.
  - `WHATSAPP_META_*` pour appeler directement l'API WhatsApp Cloud de Meta.
- Pour désactiver ponctuellement l'envoi lors d'un scrape, lancez : `python scraper.py --no-notify`.

---

## 🚢 Déploiement

### **Recommandé : Vercel** (éditeur de Next.js)
1. Connectez le repo Git à [vercel.com](https://vercel.com).
2. Vercel détecte automatiquement Next.js.
3. Renseignez les variables d'environnement dans **Project Settings → Environment Variables**.
4. Pour Supabase : ajoutez le domaine Vercel dans **Supabase Dashboard → Authentication → URL Redirects & CORS origins**.

### Autres options
- **Supabase Edge Functions** + **Fly.io** / **Railway** pour du Next standalone.
- **OVH / Scaleway** : Build statique + Node serveur (`npm run build && npm run start` derrière un nginx).

---

## 📮 Support & contact

- Site : [travaillerenci.vercel.app](https://travaillerenci.vercel.app)
- Email : achillesdev10@gmail.com
- Côte d'Ivoire 🇨🇮 — Abidjan

---

> **Pensé et construit avec ❤️ pour les talents et les entreprises ivoiriennes.**

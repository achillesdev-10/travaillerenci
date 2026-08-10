# Emails transactionnels — Architecture & diagnostic de livraison

> Dernière mise à jour : août 2026.

## 1. Architecture réelle (important)

**L'application n'utilise PAS Supabase Auth pour l'envoi d'emails.**

- L'authentification est **maison** : table `users` (SQLite en local / Supabase en
  prod), sessions via cookie httpOnly signé, vérification d'email par jeton.
- Les emails transactionnels (vérification d'email, mot de passe oublié,
  alertes candidat) sont envoyés **directement par l'API REST Resend**
  (`src/lib/email.ts`, `scraper/alert_digest.py`), sans SDK, sans passer par
  Supabase Auth.
- Conséquence : les réglages **SMTP du dashboard Supabase Auth**
  (Authentication → Settings → SMTP Settings / Email Templates) **ne sont pas
  utilisés** par ce site. Ne pas y chercher la cause.

## 2. Causes racines probables du « aucun email de confirmation reçu »

Par ordre de probabilité, sur une inscription `/candidates` ou `/register` :

| # | Cause | Symptôme | Vérification |
|---|-------|----------|--------------|
| 1 | **`RESEND_API_KEY` absent de l'environnement** (Vercel) | Aucun email, aucune erreur visible | `POST /api/auth/register` renvoie désormais `email.sent=false` + message. Log : `[auth] ⚠️ RESEND_API_KEY absent…` (warn) |
| 2 | **Domaine d'expéditeur non vérifié dans Resend** | L'API Resend répond 403/422 (« domain not verified ») | Logs Vercel : `POST /api/auth/register sendVerificationEmail error: Resend a répondu 403…` |
| 3 | **Lien de confirmation vers la mauvaise URL** | Email reçu mais lien mort/redirige mal | `NEXT_PUBLIC_SITE_URL` doit pointer vers le domaine réellement servi |
| 4 | Email en spam | Rien côté code | Vérifier le dossier spam |

### Cause 1 — `RESEND_API_KEY`

Le code d'inscription saute l'envoi en silence quand la clé manque :

```ts
// src/lib/email.ts
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}
```

- **Local** (`.env.local`) : la clé n'est PAS définie → aucun email en dev.
- **Production** : la clé doit être définie dans les variables d'environnement
  **du projet Vercel** (Settings → Environment Variables), PAS uniquement dans
  les secrets GitHub Actions (ceux-ci servent au workflow `auto-publish.yml`
  pour le digest d'alertes, pas au runtime Next.js).

### Cause 2 — domaine d'expéditeur Resend

`EMAIL_FROM` par défaut : `TravaillerEnCi <noreply@travaillerenci.ci>`.
Resend **exige que le domaine d'expéditeur soit vérifié** (SPF/DKIM) :

1. Créer un compte sur https://resend.com (si ce n'est pas déjà fait).
2. **Domaines** → Ajouter `travaillerenci.ci` (ou le domaine personnalisé actif)
   → ajouter les enregistrements DNS SPF/DKIM/DMARC chez le registrar.
3. Tant que le domaine n'est pas vérifié : utiliser le domaine de test Resend
   (`onboarding@resend.dev`) en `EMAIL_FROM` pour valider la boucle, puis
   basculer.
4. `Settings → API Keys` → créer une clé → la coller dans Vercel
   (`RESEND_API_KEY`) et dans `.env.local` pour le dev.

### Cause 3 — Site URL du lien de confirmation

Le lien de confirmation est construit avec `getSiteUrl()` (`src/lib/site.ts`) :
`NEXT_PUBLIC_SITE_URL` > localhost (dev) > `https://travaillerenci.vercel.app`.

- Vérifier que `NEXT_PUBLIC_SITE_URL` (Vercel) pointe vers le domaine réel
  (`https://travaillerenci.vercel.app` aujourd'hui, le domaine `.ci` le jour où
  il sera actif).
- Côté Supabase, les réglages Auth (Site URL / Redirect URLs) ne concernent
  que Supabase Auth — inutiles ici, mais sans incidence.

## 3. Test d'inscription complet (critère de validation)

1. Lancer `npm run dev` (ou déployer) avec `RESEND_API_KEY` + `EMAIL_FROM`
   configurés.
2. S'inscrire sur `/candidates` avec une vraie adresse email.
3. L'email « Confirmez votre adresse email — TravaillerEnCi » doit arriver en
   **moins de 2 minutes** (vérifier aussi le spam).
4. Cliquer le bouton → la page `Vérification d'email — TravaillerEnCi` doit
   afficher « Email confirmé ».
5. En cas d'échec : regarder les logs de la fonction Vercel
   (`POST /api/auth/register`) — l'erreur Resend y est journalisée
   (`Resend a répondu <status> : <body>`).

## 4. Ce que le code renvoie / journalise désormais

- `POST /api/auth/register` → `{ user, email: { configured, sent, message? } }`
  (`src/app/api/auth/register/route.ts`) :
  - `configured=false` → **warn** explicite dans les logs serveur ;
  - `sent=false` → message visible dans le formulaire d'inscription.
- `POST /api/auth/verify-email` (bouton « Renvoyer le lien ») → renvoie 503
  avec « L'envoi d'emails n'est pas configuré… » quand la clé manque
  (affiché dans le bandeau du dashboard).
- `src/lib/email.ts` : lève une erreur détaillée sur échec Resend
  (`Resend a répondu <status> : <body>`) — visible dans les logs serveur.

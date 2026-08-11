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

### 1bis. La vérification d'email est OPT-IN (depuis le 11/08/2026)

**Par défaut, aucun email de confirmation n'est envoyé** :

- `EMAIL_VERIFICATION_ENABLED` absent ou ≠ `true` → le compte est créé
  **directement vérifié** (`email_verified=true`), utilisable immédiatement,
  aucun appel à Resend. C'est le comportement actuel de la production.
- `EMAIL_VERIFICATION_ENABLED=true` → le compte est créé **non vérifié**, un
  jeton 24 h est généré (`createEmailVerificationToken`) et un email avec lien
  de confirmation est envoyé. **L'échec d'envoi ne bloque JAMAIS la création**
  (le compte reste fonctionnel) — voir § 4.

La bascule se fait dans Vercel → Settings → Environment Variables (et
`.env.local` en dev), sans redéploiement. Réactiver **uniquement** après la
vérification du domaine dans Resend (§ Cause 2).

## 2. Causes racines probables du « aucun email de confirmation reçu »

Par ordre de probabilité, sur une inscription `/candidates` ou `/register` :

| # | Cause | Symptôme | Vérification |
|---|-------|----------|--------------|
| 0 | **`EMAIL_VERIFICATION_ENABLED` absent ou ≠ true** (le plus fréquent aujourd'hui) | Aucun email — **c'est le comportement voulu** : compte créé directement vérifié | Vérifier la valeur de la variable dans Vercel / `.env.local` |
| 1 | **`RESEND_API_KEY` absent de l'environnement** (Vercel) alors que la vérification est activée | Compte créé mais aucun email, aucune erreur bloquante | Logs Vercel : `[auth] sendVerificationEmail error (non bloquant)…` (voir § 4) |
| 2 | **Domaine d'expéditeur non vérifié dans Resend** | L'API Resend répond 403/422 (« domain not verified ») | Logs Vercel : `sendVerificationEmail error: Resend a répondu 403…` |
| 3 | **Lien de confirmation vers la mauvaise URL** | Email reçu mais lien mort/redirige mal | `NEXT_PUBLIC_SITE_URL` doit pointer vers le domaine réellement servi |
| 4 | Email en spam | Rien côté code | Vérifier le dossier spam |

### Cause 1 — `RESEND_API_KEY` (uniquement si la vérification est ACTIVÉE)

Quand `EMAIL_VERIFICATION_ENABLED=true`, l'envoi se fait via `src/lib/email.ts`
(sans SDK, API REST Resend) :

- **Local** (`.env.local`) : la clé n'est PAS définie → l'envoi échoue mais le
  compte est quand même créé (échec non bloquant, § 4).
- **Production** : la clé doit être définie dans les variables d'environnement
  **du projet Vercel** (Settings → Environment Variables), PAS uniquement dans
  les secrets GitHub Actions (ceux-ci servent au workflow `auto-publish.yml`
  pour le digest d'alertes, pas au runtime Next.js).

### Cause 2 — domaine d'expéditeur Resend

**Cause racine CONFIRMÉE (diagnostic du 11/08/2026).** L'environnement de prod
utilise `EMAIL_FROM=TravaillerEnCi <onboarding@resend.dev>` — le **domaine de
TEST partagé de Resend**. Ce domaine ne livre **que vers l'adresse du compte
Resend** (`achillesdev10@gmail.com`) : tout candidat qui s'inscrit avec une
autre adresse ne reçoit rien (Resend répond 403 — voir les logs en bas de
page). Le domaine prévu pour la prod, `travaillerenci.ci`, n'est **pas encore
vérifié** sur Resend.

Vérification en 1 commande :

```bash
# OK pour l'adresse du compte Resend uniquement :
RESEND_API_KEY=re_xxx python scripts/test-resend-connection.py --to achillesdev10@gmail.com
# ❌ 403 pour toute autre adresse (domaine de test) :
RESEND_API_KEY=re_xxx python scripts/test-resend-connection.py --to candidat@exemple.ci
# ❌ 403 « domain not verified » tant que travaillerenci.ci n'est pas vérifié :
RESEND_API_KEY=re_xxx python scripts/test-resend-connection.py --to candidat@exemple.ci --from "TravaillerEnCi <noreply@travaillerenci.ci>"
```

**Correction (à faire sur le compte Resend + DNS du domaine) :**

1. Créer un compte sur https://resend.com (fait).
2. **Resend → Domains → Add Domain** → ajouter `travaillerenci.ci`.
3. Chez le registrar du domaine (`.ci`), ajouter les enregistrements DNS
   fournis par Resend :
   - **SPF** : `v=spf1 include:amazonses.com ~all` (TXT) — Resend utilise
     Amazon SES ; l'enregistrement exact est affiché dans Resend.
   - **DKIM** : 3 enregistrements TXT `resend._domainkey.travaillerenci.ci`
     (valeurs fournies dans le dashboard Resend).
   - **DMARC** (recommandé) : `v=DMARC1; p=quarantine; rua=mailto:…`.
   - Optionnel : enregistrement **MX** `feedback-smtp.us-east-1.amazonses.com`
     + enregistrement TXT de conformité pour recevoir les bounce.
   - **Maison d'enregistrement** : l'utilisateur doit avoir accès aux DNS de
     `travaillerenci.ci`.
4. Attendre la vérification par Resend (SPF/DKIM/DMARC verts), puis :
   - **Vercel → Settings → Environment Variables** (et `.env.local` en dev) :
     `EMAIL_FROM=TravaillerEnCi <noreply@travaillerenci.ci>`
   - Conserver `RESEND_API_KEY` telle quelle (clé restreinte à l'envoi, OK).
5. Refaire le test d'inscription complet (critère §3).

> NB : tant que le domaine n'est pas vérifié, il est possible de valider la
> boucle en envoyant vers l'adresse du compte Resend via `onboarding@resend.dev`
> — mais NE PAS lancer en prod avec cet expéditeur.

### Cause 3 — Site URL du lien de confirmation

Le lien de confirmation est construit avec `getSiteUrl()` (`src/lib/site.ts`) :
`NEXT_PUBLIC_SITE_URL` > localhost (dev) > `https://travaillerenci.vercel.app`.

- Vérifier que `NEXT_PUBLIC_SITE_URL` (Vercel) pointe vers le domaine réel
  (`https://travaillerenci.vercel.app` aujourd'hui, le domaine `.ci` le jour où
  il sera actif).
- Côté Supabase, les réglages Auth (Site URL / Redirect URLs) ne concernent
  que Supabase Auth — inutiles ici, mais sans incidence.

## 3. Test d'inscription complet (critère de validation)

1. Lancer `npm run dev` (ou déployer) avec `EMAIL_VERIFICATION_ENABLED=true`
   **+** `RESEND_API_KEY` + `EMAIL_FROM` configurés.
2. S'inscrire sur `/candidates` avec une vraie adresse email.
3. L'email « Confirmez votre adresse email — TravaillerEnCi » doit arriver en
   **moins de 2 minutes** (vérifier aussi le spam).
4. Cliquer le bouton → la page `Vérification d'email — TravaillerEnCi` doit
   afficher « Email confirmé ».
5. En cas d'échec : regarder les logs de la fonction Vercel
   (`POST /api/auth/register`) — l'erreur Resend y est journalisée
   (`Resend a répondu <status> : <body>`) mais **ne bloque pas** la création
   du compte.

> Sans `EMAIL_VERIFICATION_ENABLED=true`, aucune étape de ce test n'est
> pertinente : le compte est créé vérifié et aucun email n'est attendu.

## 3bis. Checklist de bascule — réactiver `EMAIL_VERIFICATION_ENABLED=true`

À exécuter **après** la vérification du domaine `travaillerenci.ci` dans Resend
(§ Cause 2) et le test complet de l'étape 3 :

1. **Vercel → Settings → Environment Variables** (production) :
   - `EMAIL_FROM=TravaillerEnCi <noreply@travaillerenci.ci>` (domaine vérifié) ;
   - `RESEND_API_KEY` = clé Resend (déjà présente si le mot de passe oublié
     fonctionne) ;
   - `EMAIL_VERIFICATION_ENABLED=true` ;
   - `NEXT_PUBLIC_SITE_URL` pointe vers le domaine réel (les liens de
     confirmation sont construits avec `getSiteUrl()`).
2. **`.env.local`** (dev) : mêmes valeurs pour tester en local.
3. Redéployer (Vercel lit les variables au déploiement).
4. Tester le parcours complet : inscription → email « Confirmez votre adresse
   email » (≤ 2 min, vérifier spam) → clic → page « Email confirmé » →
   bannière « Email non confirmé » disparaît du tableau de bord.
5. Tester le renvoi : depuis la bannière du tableau de bord, « Renvoyer le
   lien » → nouvel email reçu (1 envoi/minute max).
6. Tester les cas limites : compte Google (email vérifié par Google → aucune
   bannière), utilisateur déjà inscrit avant la bascule (déjà `email_verified`
   → rien ne change).

> Si `EMAIL_VERIFICATION_ENABLED=true` est défini SANS `RESEND_API_KEY` valide
> ni domaine vérifié : l'inscription crée quand même le compte (non bloquant),
> mais aucun email ne part — l'utilisateur reste coincé sur « Vérifiez votre
> boîte mail ». La bascule ne doit donc intervenir qu'une fois la livraison
> confirmée (étape 3).

## 4. Ce que le code renvoie / journalise désormais

- `POST /api/auth/register` → `{ user }` **uniquement** (plus de champ
  `email: { configured, sent }`). Le statut de la vérification est contrôlé par
  `isEmailVerificationEnabled()` (`src/lib/config.ts`) :
  - désactivé (défaut) → `emailVerified: true` à la création, **aucun appel à
    Resend** ;
  - activé → `emailVerified: false` + jeton 24 h (`createEmailVerificationToken`,
    table `verify_email_tokens`) + `sendVerificationEmail`. **Tout échec d'envoi
    est catché et journalisé** (`[auth] sendVerificationEmail error (non
    bloquant): …`) : le compte reste utilisable.
- `GET /api/auth/verify-email?token=…` → page HTML de confirmation (« Email
  confirmé » / « Lien invalide ou expiré »), puis `markEmailVerified` + purge
  des jetons.
- `POST /api/auth/resend-verification` → renvoie le lien de confirmation à
  l'utilisateur connecté dont l'email n'est **pas** encore vérifié (nouveau
  jeton 24 h, cooldown 1 envoi/minute, erreurs explicites : 401 sans session,
  400 déjà vérifié, 503 Resend non configuré, 429 trop fréquent). Accessible
  depuis la bannière « Email non confirmé » des tableaux de bord et l'écran
  « Vérifiez votre boîte mail » de l'inscription.
- `POST /api/auth/forgot-password` → utilise `isEmailConfigured()`
  (`src/lib/email.ts`) : sans `RESEND_API_KEY`, renvoie une erreur explicite
  (mot de passe oublié ne fonctionne pas sans Resend).
- `src/lib/email.ts` : lève une erreur détaillée sur échec Resend
  (`Resend a répondu <status> : <body>`) — visible dans les logs serveur.
- `src/lib/email.ts` (`getEmailConfigStatus`) : utilitaire de diagnostic
  exposant l'état réel de l'expéditeur (clé présente, domaine d'expéditeur,
  domaine de test `@resend.dev`). Non branché sur une route aujourd'hui —
  utilisable dans les logs/admin si besoin.

## 5. Logs du diagnostic (11/08/2026) — cause racine confirmée

Test réel de l'API Resend avec la clé de l'environnement de prod :

```
# 1. Clé API : valide mais RESTREINTE À L'ENVOI (ne permet pas de lister les domaines)
GET https://api.resend.com/domains → 401
{"statusCode":401,"message":"This API key is restricted to only send emails","name":"restricted_api_key"}

# 2. Envoi vers l'adresse du compte Resend → 200 (domaine de test ok pour le propriétaire)
POST /emails (from onboarding@resend.dev → achillesdev10@gmail.com) → 200

# 3. Envoi vers une AUTRE adresse → 403 : le domaine de test ne livre QUE au propriétaire
POST /emails (from onboarding@resend.dev → test@hotmail.fr) → 403
{"statusCode":403,"name":"validation_error","message":"You can only send testing emails to
your own email address (achillesdev10@gmail.com). To send emails to other recipients, please
verify a domain at resend.com/domains, and change the `from` address to an email using this domain."}

# 4. Envoi depuis le domaine prévu pour la prod → 403 : travaillerenci.ci NON vérifié
POST /emails (from noreply@travaillerenci.ci → test@hotmail.fr) → 403
{"statusCode":403,"message":"The travaillerenci.ci domain is not verified. Please, add and
verify your domain on https://resend.com/domains","name":"validation_error"}
```

**Conclusion** : toute inscription d'un candidat réel (`/candidates`, `/register`)
échoue à la livraison de l'email de confirmation — l'email n'est envoyé qu'au
propriétaire du compte Resend. Action requise : vérifier `travaillerenci.ci`
dans Resend (§ Cause 2) puis mettre `EMAIL_FROM` à jour dans Vercel.

# Restaurer une sauvegarde (workflow « Sauvegarde hebdomadaire »)

La base est sauvegardée chaque dimanche 03:30 UTC (ou à la demande : onglet Actions →
« Sauvegarde hebdomadaire de la base » → Run workflow). Le dump est **chiffré GPG
(AES256)** avant d'être publié en artefact, car le dépôt GitHub est public.

## 0. Prérequis (une fois)
- Secrets GitHub (Settings → Secrets and variables → Actions) :
  - `SUPABASE_DB_URL` : chaîne de connexion **Session pooler** du projet
    (Supabase → Connect → Session pooler ; les runners GitHub sont en IPv4).
  - `BACKUP_PASSPHRASE` : phrase de passe de chiffrement (à conserver HORS
    GitHub, ex. dans un gestionnaire de mots de passe).

## 1. Télécharger l'artefact
1. GitHub → Actions → run « Sauvegarde hebdomadaire… » (le plus récent).
2. Section « Artifacts » → `db-backup-<run_id>` → télécharger le `.zip`.
3. Dézipper : vous obtenez `backup-AAMMJJ.dump.gpg`.
   ⚠️ Un artefact d'un repo public reste téléchargeable par n'importe quel
   compte connecté : c'est pour ça que le fichier est chiffré.

## 2. Déchiffrer
Sur votre machine (GPG installé : `gpg` via Git Bash / Gpg4win sur Windows) :

```bash
gpg --decrypt --output backup-AAMMJJ.dump backup-AAMMJJ.dump.gpg
# pinentry demandera la BACKUP_PASSPHRASE
```

⚠️ Le `.dump` déchiffré contient des données personnelles (emails, hash de mots de
passe) : ne le committer jamais, ne le déposez dans aucun cloud non chiffré, et
supprimez-le après la restauration.

## 3. Restaurer vers un projet Supabase de test
Appliquer l'application Supabase sur un projet **de test INVALIDÉ**, jamais en
production. Récupérer sa chaîne Session pooler :

```bash
pg_restore \
  --dbname="$SUPABASE_DB_URL_TEST" \
  --no-owner --no-privileges \
  --jobs=4 \
  --clean \
  backup-AAMMJJ.dump
```

- `--clean` : supprime d'abord les objets existants du projet de test (à réserver
  à un projet vierge/rejouable).
- `--jobs=4` : restauration parallèle (plus rapide).
- Les tables `site_visits`, `analytics_events`, `alert_digest_log`,
  `scraper_logs` ont leur **structure** mais aucune donnée (exclues du dump) :
  à recréer par la collecte normale du site une fois restitué.

## 4. Après restauration (vérifications express)
- Supabase → Table Editor : lignes récentes visibles dans `users`, `job_offers`,
  `exams`, `alerts` (tables contenant des données).
- Lancer le site en local connecté au projet de test : pages /jobs, /concours,
  /admin correctes.

## En option (non implémenté) : stockage externe gratuit
Artefacts GitHub = 30 jours max et consultables par tout compte connecté. Pour
conserver des sauvegardes plus longtemps et hors GitHub : créer un bucket gratuit
Cloudflare **R2** (~10 Go offerts), générer des clés limitées à ce bucket et les
placer dans d'autres secrets GitHub, puis ajouter au workflow une étape `rclone`
`rclone copy $DUMP_FILE.gpg r2:travaillerenci-backups/` après le chiffrement.
Phrase de passe et clés R2 restent dans les secrets GitHub du repo privé que
vous voulez.

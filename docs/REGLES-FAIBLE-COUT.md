# Règles faible coût — checklist pour sites automatisés (plans gratuits)

Checklist à réappliquer à chaque nouveau site Next.js + Supabase + Vercel. Objectif : rester
sous les quotas gratuits (egress, CPU), comme la pratique retenue sur TravaillerEnCi.

## Base de données (Supabase)
- [ ] **Jamais de `select('*')` sur les listes** : définir des colonnes minimales
      (`slim` pour le SEO/pagination, `card` pour les listes publiques, `full` pour les
      fiches détail). Retirer d'abord les colonnes lourdes (textes longs, JSON).
- [ ] **Comptages avec `head: true`** (`select("id", { count: "exact", head: true })`) :
      on ne récupère que le chiffre, jamais les lignes.
- [ ] **Pagination obligatoire** (`.limit()` / `.range()`) sur toute table qui grossit
      (logs, visites, événements) — une lecture sans limite finira par exploser le quota.
- [ ] Écrire `.select("id")` sur les `update`/`delete` quand on ne lit que
      `len(resp.data)` (retours supabase-py incluent les lignes complètes par défaut).

## Rendu Next.js
- [ ] **ISR par défaut** : `export const revalidate = 300` (ou plus) sur les pages
      publiques qui ne lisent rien de propre au visiteur.
- [ ] `force-dynamic` **seulement si indispensable** (données du visiteur, compteur par
      visite…) — et dans ce cas, passer les lectures par un cache partagé
      (`unstable_cache` / chargeur en cache, 120 s minimum).
- [ ] Si la page lit `searchParams` (filtre/pagination) : rester dynamique mais toujours
      via le chargeur en cache.

## Tâches planifiées (GitHub Actions / cron)
- [ ] Cron léger (maintenance, publication pending) : 15 min max.
- [ ] Lectures lourdes (tables entières, digest d'alertes) : **max quelques fois par
      jour** — second cron + `if:` sur `github.event.schedule` pour les sauter aux autres
      passages (voir `.github/workflows/auto-publish.yml`).

## Images
- [ ] Formats modernes (`image/avif`+`image/webp` via `next/image`), images compressées.
- [ ] `remotePatterns` : liste blanche des domaines réellement utilisés (jamais `'**'`,
      qui laisse n'importe quel site consommer le CDN d'images Vercel).
- [ ] Cache long sur les fichiers non modifiables (`Cache-Control` immutable sur
      `/uploads`, versions d'URL).

## CDN et domaine
- [ ] Dès l'achat du domaine : placer un CDN gratuit (Cloudflare, cache proxifié + réspect
      des en-têtes cache de Next) devant le site — réduit drastiquement les hits Vercel/Supabase.

## Surveiller la consommation
- [ ] **Supabase** : Dashboard → Reports (API, egress) et Settings → Usage (quotas).
- [ ] **Vercel** : onglet Usage (fonctions serverless, bande passante, images).
- [ ] Revoir la consommation après chaque nouvelle feature publique.

# Module Concours Administratifs — Sources officielles

> Dernière vérification des domaines : **août 2026**.
> ⚠️ Les plateformes de concours ivoiriennes changent fréquemment de
> sous-domaine d'une session à l'autre. **Toutes les URLs sont centralisées
> dans [`scraper/config/exam_sources.json`](../scraper/config/exam_sources.json)**
> — on les corrige là, sans redéploiement du code.
>
> Règle absolue : sources **primaires officielles uniquement**. Jamais de
> scraping d'agrégateurs concurrents (Ablanian.ci ou autre).

## Inventaire des sources

| Id | Institution | URL retenue | robots.txt | Type | Fréquence observée | Statut |
|----|-------------|-------------|------------|------|--------------------|--------|
| `gucaci` | GUCACI — Guichet Unique des Concours Administratifs (Fonction Publique) | `https://gucaci.ciconcours.com/` | ouvert | plateforme ciconcours | hebdomadaire en période de concours | ✅ actif |
| `fonctionpublique` | Ministère de la Fonction Publique et de la Modernisation de l'Administration | `https://www.fonctionpublique.gouv.ci/` | non standard (XML pare-feu `secure.sndi.ci`) | actualités / communiqués | hebdomadaire | ✅ actif |
| `ena` | École Nationale d'Administration | `https://www.ena.ci/` | standard, sitemap présent | actualités / concours (**communiqués en PDF**) | mensuelle (cycles moyen / moyen supérieur / supérieur) | ✅ actif (fiches créées depuis les PDF) |
| `defense` | Ministère de la Défense (Armée, Gendarmerie) | `https://defense.ciconcours.net/` | à vérifier | plateforme ciconcours | par session (concours sous-officiers, AFA Zambakro, ENSOA, gendarmerie) | ✅ corrigé le 10/08/2026 (l'ancien `concours-defense.ciconcours.com` était mort en DNS) |
| `infas` | INFAS — Institut National de Formation des Agents de Santé | `https://infas.ciconcours.com` | à vérifier | plateforme ciconcours | annuelle (sept.–oct.) | ✅ actif (timeouts CI transitoires — site répond 200) |
| `injs` | INJS — Institut National de la Jeunesse et des Sports | `https://concours.injsabidjan.com/` | à vérifier | plateforme ciconcours | annuelle (PC-EPS, filières sportives) | ✅ corrigé le 10/08/2026 (l'ancien `concours.injsabidjan.ci` était mort en DNS) |
| `cafop` | CAFOP — Ministère de l'Éducation Nationale / DECO | `https://www.men-deco.org` | à vérifier | actualités / résultats | par tour (CAFOP IA) | ✅ actif |
| `insfs` | INSFS — Institut National Supérieur de Formation Sociale | `https://insfs.ciconcours.com` | ouvert | plateforme ciconcours | annuelle | ✅ actif (timeouts CI transitoires — site répond 200) |
| `aip` | AIP — Agence Ivoirienne de Presse (veille secondaire) | `https://www.aip.ci/` | ouvert | veille presse | quotidienne (relais des communiqués) | ⏸️ désactivée le 10/08/2026 (accueil 500 / recherche 301) — à réactiver ~24/08/2026 |
| `servicepublic` | Service Public CI (portail transverse) | `https://servicepublic.gouv.ci/` | ouvert | démarches | ponctuel (complément) | ⏸️ désactivé par défaut |

### Plateformes de la famille `ciconcours.com`
Les plateformes d'inscription (GUCACI, INFAS, INSFS, INJS, Défense…) partagent
le même moteur. Le scraper `CiconcoursPlatformScraper` collecte les fiches de
concours (titre, texte, PDF) depuis les listes `concours-{année}/liste-concours/…`.
Le niveau de détail et les URLs exactes doivent être contrôlés à chaque build
via `python scraper/exams_runner.py --check-sources`, qui produit le rapport
robots.txt utilisé pour mettre à jour ce tableau.

## Pipeline de traitement

1. **Scraping brut** → `scraper/exam_sources.py` (par type de source).
2. **Vérification robots.txt** → `scraper/core/robots_check.py` (source
   interdite = ignorée, rapporté dans le log).
3. **Réécriture 100% + extraction structurée** → `scraper/core/gemini_exams.py` :
   - reformulation à 100% (jamais de copier-coller, même d'une source officielle) ;
   - extraction des champs du schéma `exams` (diplôme, âge, nationalité, dates…) ;
   - `null` explicite quand une info manque (jamais de valeur inventée) ;
   - champ `confidence` (low/medium/high) pour prioriser la relecture manuelle.
   - **Repli heuristique** : `scraper/core/exam_parser.py` (sans clé IA).
   - **Contrôle anti-duplication** : `scraper/core/similarity_check.py` compare la
     réécriture au texte source (similarité de séquence + Jaccard sur n-grams).
     Au-delà du seuil (30 % par défaut, option `--similarity-threshold`), la
     fiche est marquée `confidence='low'` et signalée dans le rapport du runner
     (`⚠️ N à réécrire`) pour réécriture manuelle en modération — jamais de
     copier-coller publié tel quel (pénalité Google contenu dupliqué).
4. **Insertion en `pending`** dans `exams` → `scraper/database/exam_repository.py`.
5. **Modération admin** → `/admin/exams` (éditer, valider → publier, rejeter,
   supprimer). `source_url` obligatoire avant publication.
6. **Notification WhatsApp** → service prêt mais **inactif par défaut**
   (voir `WHATSAPP_NOTIFY_ENABLED` dans [`src/services/whatsappNotify.ts`](../src/services/whatsappNotify.ts)).

## Structures types des communiqués (calibration Gemini)

Les communiqués ivoiriens suivent presque toujours ces trames (utilisées pour
le prompt d'extraction et les tests unitaires `scraper/tests/test_exam_parser.py`) :

1. **Administratif (Fonction Publique)** — « [N] concours administratifs sont
   ouverts dont [x] recrutements nouveaux et [y] promotions. Les inscriptions en
   ligne débuteront le [d1] pour prendre fin le [d2]. […] Pour les grades D1 à
   A3, l'âge maximum est de [x] ans et pour le grade A4, de [y] ans. »
2. **ENA** — « Les inscriptions […] se font du [d1] au [d2]. Peuvent faire acte
   de candidature les personnes de nationalité ivoirienne âgées de [min] ans au
   moins et de [max] ans au plus au 31 décembre [année], et titulaires d'un
   [diplôme]. Les frais d'inscription sont fixés à [montant] Fcfa. »
3. **Militaire / gendarmerie** — « Les inscriptions […] du [d1] au [d2],
   exclusivement en ligne sur [url]. Ce concours s'adresse aux jeunes ivoiriens
   âgés de [min] à [max] ans au 31 décembre [année] et titulaires du [diplôme].
   Les épreuves […] sont prévues pour le [date]. La visite médicale se fera du
   [d] au [d]. » → la **visite médicale** (pas de champ dédié) est décrite dans
   `description_md` (une étape de timeline front pourra l'ajouter plus tard).
4. **INFAS / santé** — « La préinscription en ligne se fera du [d1] au [d2] sur
   [url]. La phase d'inscription se déroulera du [d3] au [d4]. […] [x] filières
   sont accessibles aux titulaires du [diplôme A], du [diplôme B] ou du
   [diplôme C] selon les spécialités. » → **une entrée par filière** est
   recommandée pour un filtrage propre par diplôme (la version actuelle stocke
   une entrée par communiqué avec tous les diplômes ; l'éclatement par filière
   peut être fait en modération ou dans une itération future du parser).

## Notes sur les changements de domaine

- **fonctionpublique.gouv.ci** : les inscriptions passent désormais par GUCACI ;
  le site ministériel publie les communiqués (section « À la une »). Le
  `robots.txt` renvoie une réponse XML (pare-feu) — l'exploration en lecture
  simple reste possible et est documentée.
- **INJS** : l'ancien `concours.injsabidjan.ci` était mort en DNS (10/08/2026) ;
  remplacé par `concours.injsabidjan.com` (répond 200). La plateforme a connu
  des variantes `.com` / `.net` / `.ci` selon les années : ne pas coder l'URL en
  dur, passer par `exam_sources.json`.
- **Défense** : l'ancien `concours-defense.ciconcours.com` était mort en DNS
  (10/08/2026) ; remplacé par `defense.ciconcours.net` (répond 200). Le
  sous-domaine de la plateforme militaire change d'une session à l'autre — les
  chaînes WhatsApp officielles citées dans les communiqués sont utiles pour la
  **modération humaine** mais ne sont pas scrapables automatiquement.
- **GUCACI / INFAS / INSFS** (`*.ciconcours.com`) : joignables (HTTP 200, ~1 s)
  depuis un poste classique ; les timeouts constatés en CI proviennent du
  réseau GitHub Actions (IP de datacenter throttlée / WAF). Ne pas désactiver
  ces sources pour autant — vérifier d'abord via `--check-sources`.
- **ENA** : les avis de concours sont publiés en PDF
  (`/assets/fichiers/communiques/*.pdf`), sans page HTML associée. Le scraper
  crée une fiche « communiqué officiel » par PDF (titre = nom du fichier, lien
  source = PDF).
- **AIP** : accueil en HTTP 500 et recherche en 301 le 10/08/2026 — site
  instable ; les erreurs sont journalisées distinctement, la source reste
  activée (veille secondaire).

## Vérification périodique

```bash
# Rapport robots.txt + URLs de toutes les sources (à intégrer à chaque build)
python scraper/exams_runner.py --check-sources

# Lancement du module concours (écrit en pending dans exams)
python scraper/exams_runner.py --max-per-source 10

# Tests unitaires du parseur (4 structures types)
python scraper/tests/test_exam_parser.py

# Tests unitaires du contrôle anti-duplication (similarité source ↔ réécriture)
python scraper/tests/test_similarity_check.py
```

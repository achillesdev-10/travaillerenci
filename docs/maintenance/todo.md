# TODO maintenance

## 1. Statistiques admin

- [x] Corriger `db.close()` exécuté avant la requête du total dans `src/lib/admin-analytics.ts`.
- [x] Vérifier les totaux SQLite : total, aujourd'hui, semaine, visiteurs uniques, top pages.
- [x] Corriger `uniqueVisitors` Supabase avec un décompte réel des IP distinctes.
- [x] Corriger `topPages` Supabase : agrégation sur toute la fenêtre, pas sur 12 lignes.
- [x] Corriger la répartition quotidienne Supabase, qui ne lisait que les agrégats historiques.
- [ ] Vérifier l'agrégat `site_visits_daily` en production (clés Supabase indisponibles localement).

## 2. Analytics mobile

- [x] Simplifier l'affichage mobile de `AnalyticsClient.tsx`.
- [x] Conserver les informations essentielles et les filtres utiles.

## 3. Blog

- [x] Identifier la cause : `orderBy` valait `undefined` quand `order_by` était absent.
- [x] Corriger la liste SQLite et Supabase de `BlogService`.
- [x] Retirer `view_count` des colonnes de liste pour éviter une dépendance à la migration `0022`.
- [x] Vérifier localement : 16 articles publiés listés, article par slug accessible.
- [ ] Vérifier la production Supabase (clés indisponibles localement).
- [x] Corriger sans modifier les contenus éditoriaux.

## 4. Générateur de CV

- [x] Ajouter photo, langues et centres d'intérêt au modèle et au formulaire.
- [x] Normaliser les anciennes données `localStorage`.
- [x] Rendre l'aperçu plus clair et professionnel.
- [x] Corriger l'export PDF multi-pages.

## 5. Menu CV

- [x] Ajouter une entrée CV visible dans le menu desktop.
- [x] Vérifier la cohérence desktop/mobile et l'accessibilité.

## 6. Concours

- [x] Ajouter une image de header pertinente avec overlay lisible.
- [x] Conserver les filtres, phases et appels à l'action existants.

## 7. SEO

- [x] Ajouter les métadonnées de la page d'accueil.
- [x] Compléter le sitemap avec `/actualites` et les articles de blog.
- [x] Exclure `/cz7tk` des robots et vérifier l'indexation des pages publiques.

## 8. PWA

- [x] Exclure `/cz7tk`, `/dashboard`, `/login`, `/register`, `/reset-password` et les API du cache.
- [x] Ajouter une page hors ligne.
- [x] Vérifier le manifeste et les icônes.

## 9. Tests globaux

- [x] `npx tsc --noEmit`
- [x] `npm test`
- [x] `npm run build`
- [ ] Vérification mobile et desktop des pages modifiées.

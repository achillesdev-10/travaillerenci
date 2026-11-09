# Refonte UI minimaliste — Rapport final

## Contexte

- Branche : `feat/ui-refonte-minimal`
- Point de départ : tag local `checkpoint/ui-refonte-start`
- Dernier commit de la refonte : `fd70587 feat(ui): refonte minimaliste orange/noir des pages publiques et dashboards`
- Aucun push, aucune fusion de `feat/ui-images-illustrations`, aucun déploiement production.

## Direction visuelle

- Texte noir pur : `#000000`
- Orange principal : `#C2410C`
- Orange hover : `#9A3412`
- Fond d’accent : `#FFF4E9`
- Fond principal : `#FFFFFF`
- Vert supprimé de l’identité visuelle (illustrations, images de repli, OG, e-mails et boutons de confirmation), conservé uniquement pour les états fonctionnels « succès » et les couleurs de marques tierces de l’annuaire entreprises.
- Cartes, listes et formulaires simplifiés : bordures `border-line`, suppression des vignettes d’offres, accents orange sobres.
- Mode sombre conservé avec fonds neutres et textes blancs.

## Périmètre livré

- Design system : tokens, `cn()` fiable, `Button`, `Badge`, `SectionHeader`, `EmptyState`.
- Branding : `layout.tsx`, manifest, favicon et icônes PWA.
- Layout global : header, footer, navigation mobile, `AppShell`, assistant flottant.
- Accueil : hero, recherche, statistiques, carrousel, offres, secteurs, forum, blog, bénéfices, CTA.
- Offres : listes `/jobs`, `/stages`, `/jobs/today`, fiches offre, cartes texte-only.
- Pages publiques : concours, bourses, actualités, blog, entreprendre, publier une offre, générateur de CV, contact, à propos, entreprises, candidats, carrières.
- Auth : connexion, inscription, réinitialisation, composants de formulaire.
- Dashboards candidat et entreprise.
- Page 404 personnalisée.
- Captures de validation : `docs/ui-refonte/`.

## Vérifications

| Commande | Résultat |
| --- | --- |
| `npm run lint` | OK |
| `npx tsc --noEmit` | OK |
| `npm test` | OK — 318 tests |
| `npm run build` | OK — warning préexistant `src/lib/admin-dashboard.ts:1554` (`spawn` + tracing) |
| `npx playwright test e2e/jobs.spec.ts` | OK — 9/9 |
| `npx playwright test e2e/responsive.spec.ts` | OK — 9/9 |
| `npx playwright test e2e/accessibility.spec.ts` | OK — 10/10 (1 timeout de navigation lors de la première passe, test rejoué seul avec succès) |

### SEO

Les 2 échecs précédents (`/emplois-informatique-abidjan` en 404 et chips de maillage sans landing) provenaient d’un cache `.next` obsolète alimenté par les fixtures E2E. Après suppression complète de `.next`, redémarrage du serveur et réinsertion des fixtures, les 9 tests de `e2e/jobs.spec.ts` passent, dont les 2 landings SEO. Aucun seuil ni jeu de données n’a été modifié.

### Responsive

Audit automatisé des largeurs 320, 360, 375, 390, 412, 430, 768 et 1280 px sur 12 pages publiques : aucun débordement horizontal détecté.

### Barre « Postuler » mobile

Mesure à 390×844 : barre sticky de 711 à 779 px, navigation mobile de 779 à 844 px. Le chevauchement de 1 px avec la bordure de la navigation est ramené à 0 px via `bottom: calc(4rem + 1px + env(safe-area-inset-bottom))`. L’assistant flottant reste 19 px au-dessus de la barre. La barre se décroche avant le footer et laisse place au footer en bas de page.

### Couleurs

Audit admin et dashboards : aucun vert décoratif. Les verts restants sont fonctionnels (`--color-success`, badge « succès », phase « ouvert » des OG concours) ou appartiennent à des marques tierces de l’annuaire entreprises. Les anciens verts décoratifs (repli d’image, illustrations SVG, image OG concours, e-mails, boutons de confirmation) ont été basculés sur la palette orange/noir.

## Captures

- `01-accueil-mobile.png`
- `02-offres-mobile.png`
- `03-fiche-offre-mobile.png`
- `04-fiche-offre-mobile-bas.png`
- `05-accueil-desktop.png`
- `06-dashboard-candidat-mobile.png`
- `07-dashboard-entreprise-desktop.png`
- `08-fiche-offre-mobile-haut.png`
- `09-fiche-offre-mobile-milieu.png`
- `10-fiche-offre-mobile-bas.png`
- `11-concours-desktop.png`
- `12-admin-dashboard-desktop.png`

L’indicateur Next.js de développement a été masqué sur les captures finales. Les captures 08 à 10 sont des captures viewport (et non `fullPage`) pour vérifier la barre sticky et l’assistant sans artefact de positionnement.

## Nettoyage

- Fixtures E2E et comptes `e2e-*@test.ci` supprimés.
- Offres manuelles `99999999-9999-4999-8999-999999999901/902` supprimées.
- Script temporaire `scripts/_tmp-seo-check.ts` supprimé.
- L’offre locale expirée a été purgée par la maintenance automatique de `/cz7tk` (règle existante : offre de plus de 21 jours avec deadline dépassée).

## Points restants

- La barre CTA « Postuler » reste `sticky` et disparaît avant le footer ; seul son offset de 1 px a été corrigé.
- Les couleurs fonctionnelles des KPI de l’admin (bleu, violet, rose, rouge) restent distinctes ; aucun vert décoratif.
- Champs `image` / `color` devenus inutiles dans certaines constantes de l’accueil : nettoyage optionnel.

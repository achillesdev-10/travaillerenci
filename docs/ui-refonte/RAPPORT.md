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
- Vert supprimé de l’identité visuelle, conservé uniquement pour l’état fonctionnel « succès » du badge.
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
| `npx playwright test e2e/responsive.spec.ts e2e/jobs.spec.ts e2e/accessibility.spec.ts` | 26 réussis, 2 échecs SEO |

### Playwright

Les 2 échecs concernent uniquement les landings SEO métier × ville :
`/emplois-informatique-abidjan` renvoie 404 et les chips de maillage ne trouvent pas de landing éligible. Ces tests dépendent des seuils de données SEO locaux, non du rendu visuel modifié. À revérifier avec le jeu de données de production.

### Responsive

Audit automatisé des largeurs 320, 360, 375, 390, 412, 430, 768 et 1280 px sur 12 pages publiques : aucun débordement horizontal détecté.

## Captures

- `01-accueil-mobile.png`
- `02-offres-mobile.png`
- `03-fiche-offre-mobile.png`
- `04-fiche-offre-mobile-bas.png`
- `05-accueil-desktop.png`
- `06-dashboard-candidat-mobile.png`
- `07-dashboard-entreprise-desktop.png`

L’indicateur Next.js de développement a été masqué sur les captures finales. Les éléments `fixed` (assistant, navigation mobile) peuvent apparaître à mi-page sur les captures `fullPage` : artefact attendu de la capture, pas du rendu réel.

## Points restants

- La barre CTA « Postuler » de la fiche offre reste `sticky` et disparaît en bas de page. Comportement conservé pour ne pas modifier la logique existante.
- Les couleurs fonctionnelles restantes dans l’admin (statuts, graphiques, alertes) n’ont pas été unifiées.
- Champs `image` / `color` devenus inutiles dans certaines constantes de l’accueil : nettoyage optionnel.
- Fixtures E2E et comptes de test nettoyés. Serveur de développement arrêté.

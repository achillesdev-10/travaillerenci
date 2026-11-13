# Optimisation TravaillerEnCI — Documentation des Phases

Point d'entrée central pour toutes les phases d'optimisation du projet. Chaque phase est documentée dans ses propres fichiers Markdown.

---

## Phases Terminées

### Phase 1 : Optimisations du Cache
- **État** : Terminée et validée localement
- **Fichiers clés** : `src/lib/cachedContent.ts` — `unstable_cache` avec revalidate TTL
- **Résultats** : Mise en cache des listes d'offres, examens, articles avec TTL 2h (120s) et 24h (86400s)
- **Tests** : 242 tests unitaires tous validés

### Phase 2 : Audit et Optimisations Supabase
- **État** : Terminée et validée localement
- **Fichiers clés** :
  - `src/services/platformSettingsService.ts` — fonction `valuesAreEqual()` pour upsert sélectif
  - Toutes les API routes Supabase
  - Migration et nettoyage de la base
- **Résultats** :
  - 20+ problèmes de consommation identifiés
  - Optimisation upsert sélectif implantée
  - Zéro fichier source modifié pendant l'audit (contrainte respectée)
  - TypeScript compilation validée (npx tsc --noEmit: OK)

### Phase 2.2 : Filtrage des écritures de platformSettingsService
- **État** : Terminée et validée localement
- **Fichier clé** : `src/services/platformSettingsService.ts` — `valuesAreEqual()` compare anciennes nouvelles valeurs avant écriture
- **Résultats** : Écritures Supabase réduites de manière significative uniquement pour les clés réellement changées

---

## Phase En Cours — Terminé P3-01

### Phase 3 : Audit Vercel et tâches restantes
- **État** : Audit complet effectué, P3-01 implémenté et validé, 6 tâches restantes
- **Fichiers créés** :
  - `docs/optimisation/phase-3-audit-vercel.md` — rapport complet d'audit
  - `docs/optimisation/phase-3-todo.md` — 7 tâches indépendantes (P3-01 à P3-07)
  - `docs/optimisation/README.md` — point d'entrée central
- **Tâches identifiées** : 7 tâches P3-01 à P3-07 (voir phase-3-todo.md pour détails)
  - P3-01 TERMINÉ : Vérifier et sécuriser l'utilisation de `withOgImages` dans les routes de production ✅
  - P3-02 À FAIRE : Étudier l'optimisation de `fromSqliteRows` dans `admin-analytics.ts`
  - P3-03 À FAIRE : Étudier la possibilité d'agréger les statistiques directement en SQL
  - P3-04 À FAIRE : Étudier le cache de `/api/admin/search`
  - P3-05 À FAIRE : Évaluer le coût CPU de `recommendationScoring.ts` avec des volumes réalistes
  - P3-06 À FAIRE : Examiner le coût de traitement de `/api/analytics/track`
  - P3-07 À FAIRE : Définir un suivi des métriques Vercel CPU Active Usage avant/après optimisation
- **Contraintes** : Aucun fichier source `src/` modifié pendant l'audit
- **Prochaines étapes** : Implémentation des tâches P3-02 à P3-07 (sur autorisation)

---

## Structure des Fichiers

```
docs/optimisation/
├── README.md                # Point d'entrée central (cette page)
├── phase-3-audit-vercel.md  # Rapport d'audit Vercel CPU (Phase 3)
├── phase-3-todo.md          # Tâches indépendantes P3-01 à P3-07
└── [futures phases]         # Phase 4, Phase 5, etc. selon évolution
```

---

## Consignes de Référence

- **Toujours consulter** `README.md` en premier pour contexte global
- **Ne jamais modifier** les fichiers source `src/` pendant les phases d'audit
- **Toutes les tâches** restent en statut `À FAIRE` jusqu'à implémentation et validation
- **Les rapports d'audit** sont la source de vérité — les hypothèses ne sont pas des faits confirmés
- **La cohérence** entre `README.md`, le rapport d'audit et le fichier TODO doit toujours être maintenue
- **Aucune tâche** n'est marquée terminée par analyse seule — implémentation + tests requis

---

## État de Cohérence (Validation)

- [x] `phase-3-audit-vercel.md` créé avec rapport complet
- [x] `phase-3-todo.md` créé avec 7 tâches (P3-01 à P3-07)
- [x] `README.md` créé avec description des phases
- [x] Aucun fichier source `src/` modifié pendant l'audit Phase 3
- [x] Toutes les optimisations Phase 1 et Phase 2 intactes et validées
- [x] 242/242 tests unitaires toujours passants
- [x] TypeScript compilation OK (npx tsc --noEmit)

*Dernière mise à jour : 10 novembre 2026*
# Maintenance TravaillerEnCi

Ce dossier suit les opérations de maintenance et de correction du site.

## Règles

- Ne jamais supprimer ni vider `site_visits` ou les contenus éditoriaux.
- Ne pas fabriquer de statistiques ni de données de démonstration en production.
- Aucune migration destructive sans sauvegarde et validation.
- Aucun commit, push ou déploiement sans autorisation explicite.
- Préserver les modifications non commitées déjà présentes dans le working tree.

## Fichiers

- `README.md` : cadre et commandes de validation.
- `todo.md` : avancement des 9 chantiers.
- `rapport.md` : diagnostic, causes racines et corrections apportées.

## Validation

```bash
npx tsc --noEmit
npm test
npm run build
```

## Sources de données

- Production : Supabase, si `NEXT_PUBLIC_DB_PROVIDER=supabase` et clés présentes.
- Local : SQLite `data/travaillerenci.sqlite3`, provider par défaut.
- Les clés Supabase de production ne sont pas disponibles dans l'environnement local actuel.

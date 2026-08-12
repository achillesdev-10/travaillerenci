//  TravaillerenCi — eslint.config.mjs (flat config, ESLint 9)
//
//  Next.js 16 a retiré la commande `next lint` : on lance ESLint directement
//  via `npm run lint` (eslint .) avec les configs flat fournies par
//  eslint-config-next (core-web-vitals + typescript).
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

export default defineConfig([
  // Configs officielles Next.js (équivalent de l'ancien
  // "extends": ["next/core-web-vitals", "next/typescript"])
  ...nextVitals,
  ...nextTs,

  // Fichiers générés / hors-lint
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "node_modules/**",
    "next-env.d.ts",
    "public/**",
    // Le scraper est un projet Python séparé : ses bundles JS (playwright,
    // .venv…) ne doivent jamais être lintés.
    "scraper/**",
    "data/**",
  ]),

  // Règles projet (préserver les conventions existantes)
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      // Typographie française : les apostrophes et guillemets bruts sont
      // omniprésents dans les textes du site et sont correctement échappés
      // par React — la règle est désactivée.
      "react/no-unescaped-entities": "off",
      // Nouvelles règles react-hooks v6 (React 19) très agressives : les
      // motifs existants (hydratation depuis localStorage, réponse à un
      // changement de route) sont volontaires — signalés en warning, non bloquants.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
]);

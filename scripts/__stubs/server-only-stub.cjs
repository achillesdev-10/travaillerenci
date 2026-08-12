/**
 *  TravaillerEnCi — Stub du package `server-only` pour les scripts de test tsx.
 *  Chemin : scripts/__stubs/server-only-stub.cjs
 *
 *  Le paquet `server-only` lève une erreur dès qu'il est importé hors d'un
 *  Server Component Next.js. Les tests tsx (scripts/test-*.ts) importent des
 *  services serveur (supabase.ts, rateLimit.ts…) qui l'importent en premier :
 *  ce stub neutralise cette garde pour l'exécution locale des tests.
 *
 *  USAGE :
 *    node --require ./scripts/__stubs/server-only-stub.cjs --import tsx scripts/test-assistant.ts
 */

/* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unused-vars */
const Module = require('node:module');

const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === 'server-only') {
    return {};
  }
  return originalLoad.apply(this, arguments);
};

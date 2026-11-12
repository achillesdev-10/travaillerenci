/**
 *  TravaillerEnCi — public/sw.js
 *  Service worker PWA (requis pour l'installation mobile : Chrome/Android
 *  exige un SW avec un handler fetch pour proposer « Installer l'application »).
 *
 *  Stratégies volontairement PRUDENTES pour ne jamais servir de contenu périmé :
 *    • Navigations (pages HTML) : réseau d'abord, repli sur le cache hors-ligne.
 *    • Assets statiques (JS/CSS/images/fonts) : cache d'abord avec mise à jour
 *      en arrière-plan (stale-while-revalidate).
 *    • Appels /api/** : jamais interceptés (réseau direct).
 *
 *  Versionner la constante CACHE_VERSION pour invalider le cache après un
 *  déploiement (ex. 1 → 2).
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `travaillerenci-${CACHE_VERSION}`;
// Icônes + page hors-ligne : précacher la page d'accueil échouerait tout
// l'install si le réseau est instable pendant le déploiement (une requête en
// échec = install rejeté). La page d'accueil sera mise en cache au premier
// chargement en ligne.
const PRECACHE_URLS = [
  '/icon-192.png',
  '/icon-maskable-512.png',
  '/offline.html',
];

// Espaces privés : jamais mis en cache, même pour les navigations.
const PRIVATE_PREFIXES = [
  '/cz7tk',
  '/dashboard',
  '/login',
  '/register',
  '/reset-password',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Purge les caches des anciennes versions.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // hors-site : laisser le navigateur
  if (url.pathname.startsWith('/api/')) return; // données : jamais mises en cache
  if (
    PRIVATE_PREFIXES.some(
      (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
    )
  ) {
    return; // espaces privés : réseau direct, jamais de cache
  }

  // Navigations : réseau d'abord, sinon cache (hors-ligne), sinon page dédiée.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Ne jamais mettre en cache une page d'erreur (500/404) : hors-ligne,
          // l'utilisateur verrait l'erreur au lieu de la dernière bonne version.
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match('/offline.html');
          if (offline) return offline;
          return (await caches.match('/')) || Response.error();
        }),
    );
    return;
  }

  // Assets statiques : stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

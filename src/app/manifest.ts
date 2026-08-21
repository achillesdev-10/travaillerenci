import type { MetadataRoute } from 'next';

/**
 *  TravaillerEnCi — src/app/manifest.ts
 *  Manifest PWA (servi automatiquement à /manifest.webmanifest par Next.js).
 *
 *  Rend le site INSTALLABLE sur mobile (Chrome/Android, Edge, Samsung Internet) :
 *  nom, icônes 192×192 + 512×512 (dont une maskable pour les icônes
 *  adaptatives), display: standalone et couleurs de thème.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: "travaillerenci - Emploi & CV IA en Côte d'Ivoire",
    short_name: 'travaillerenci',
    description:
      "Trouvez un emploi en Côte d'Ivoire et créez votre CV optimisé par l'IA.",
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#059669',
    lang: 'fr',
    categories: ['jobs', 'education', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
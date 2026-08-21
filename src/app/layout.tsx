import type { Metadata, Viewport } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/layout/AppShell';
import AnalyticsTracker from '@/components/analytics/AnalyticsTracker';
import LegacyAccountMigrator from '@/components/auth/LegacyAccountMigrator';
import { getSiteUrl } from '@/lib/site';
import { LOCAL_IMAGES } from '@/lib/images';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

// Viewport mobile + PWA : désactive le zoom intempestif sur mobile.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#059669' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "travaillerenci - Emploi & CV IA",
    template: '%s | travaillerenci',
  },
  description: "Trouvez un emploi en Côte d'Ivoire et créez votre CV optimisé par l'IA.",
  keywords: ['emploi', 'côte d\'ivoire', 'jobs', 'offres d\'emploi', 'travail', 'abidjan', 'carrière', 'recrutement', 'cv', 'ia'],
  authors: [{ name: 'TravaillerenCi Team' }],
  // PWA : manifeste Web App (installable sur mobile via Chrome/Android, Edge, iOS).
  manifest: '/manifest.webmanifest',
  // Base des URLs absolues (og:url, canonical, sitemap…) — domaine actuel,
  // remplaçable via NEXT_PUBLIC_SITE_URL le jour où travaillerenci.ci sera actif.
  metadataBase: new URL(getSiteUrl()),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'travaillerenci',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/icons/icon-192x192.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    url: getSiteUrl(),
    siteName: 'TravaillerenCi',
    title: 'TravaillerenCi - Offres d\'emploi en Côte d\'Ivoire',
    description: 'Trouvez votre emploi de rêve en Côte d\'Ivoire.',
    images: [{ url: LOCAL_IMAGES.ogImage, width: 1200, height: 630, alt: 'TravaillerenCi — Offres d\'emploi, stages, bourses et concours en Côte d\'Ivoire' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TravaillerenCi - Offres d\'emploi en Côte d\'Ivoire',
    description: 'Trouvez votre emploi de rêve en Côte d\'Ivoire.',
    images: [LOCAL_IMAGES.ogImage],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem('travaillerenci_theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (stored === 'dark' || (!stored && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        {/* PWA : enregistrement du service worker en production uniquement */}
        {process.env.NODE_ENV === 'production' && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
                  window.addEventListener('load', function () {
                    navigator.serviceWorker.register('/sw.js').catch(function (err) {
                      console.warn('Enregistrement du service worker impossible:', err);
                    });
                  });
                }
              `,
            }}
          />
        )}
      </head>
      <body className="min-h-screen flex flex-col bg-background dark:bg-slate-950 dark:text-gray-100 transition-colors">
        <AnalyticsTracker />
        <LegacyAccountMigrator />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}

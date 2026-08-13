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

// Couleurs du thème pour la barre d'adresse mobile + PWA (manifest.ts).
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#00a83f' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: 'TravaillerenCi - Offres d\'emploi en Côte d\'Ivoire',
    template: '%s | TravaillerenCi',
  },
  description: 'Trouvez votre emploi de rêve en Côte d\'Ivoire. Découvrez des milliers d\'offres d\'emploi, des stages et des opportunités professionnelles.',
  keywords: ['emploi', 'côte d\'ivoire', 'jobs', 'offres d\'emploi', 'travail', 'abidjan', 'carrière', 'recrutement'],
  authors: [{ name: 'TravaillerenCi Team' }],
  // Base des URLs absolues (og:url, canonical, sitemap…) — domaine actuel,
  // remplaçable via NEXT_PUBLIC_SITE_URL le jour où travaillerenci.ci sera actif.
  metadataBase: new URL(getSiteUrl()),
  icons: {
    icon: [
      { url: '/icon.png', sizes: '512x512', type: 'image/png' },
      { url: '/favicon.ico', sizes: '48x48', type: 'image/x-icon' },
    ],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
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

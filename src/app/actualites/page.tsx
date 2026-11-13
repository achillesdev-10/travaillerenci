import type { Metadata } from 'next';
import { getCachedArticles } from '@/lib/cachedContent';
import { getSiteUrl } from '@/lib/site';
import ActualitesPublicClient from './ActualitesPublicClient';

// Page statique régénérée en arrière-plan : aucune base interrogée à chaque
// visite. Les publications d'articles invalident le tag `articles`.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Actualités emploi & formation en Côte d'Ivoire",
  description:
    "Restez informé des dernières actualités emploi, formation et concours en Côte d'Ivoire : guides de préparation, conseils carrière et alertes du marché du travail.",
  keywords: [
    'actualités emploi',
    "formation côte d'ivoire",
    'marché du travail',
    'conseils carrière',
    'guides concours',
    'emploi abidjan',
  ],
  alternates: {
    canonical: `${getSiteUrl()}/actualites`,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    url: `${getSiteUrl()}/actualites`,
    siteName: 'TravaillerenCi',
    title: 'Actualités emploi & formation | TravaillerEnCi',
    description: 'Guides, conseils et actualités du marché du travail ivoirien.',
  },
};

export default async function ActualitesPage() {
  const [{ rows: articles }, { rows: mostViewed }] = await Promise.all([
    getCachedArticles({
      status: 'published',
      order_by: 'published_at',
      order_dir: 'desc',
      limit: 60,
      fields: 'card',
    }),
    getCachedArticles({
      status: 'published',
      order_by: 'view_count',
      order_dir: 'desc',
      limit: 6,
      fields: 'card',
    }),
  ]);

  return <ActualitesPublicClient articles={articles} mostViewed={mostViewed} />;
}

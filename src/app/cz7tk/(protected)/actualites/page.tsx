import { ArticleService } from '@/services/articleService';
import ActualitesAdminClient from './ActualitesAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminActualitesPage() {
  // Deux requêtes bornées plutôt qu'une seule : les articles en attente de
  // validation restent toujours visibles, même au-delà des 100 plus récents.
  const [pending, recent] = await Promise.all([
    ArticleService.list({
      status: 'pending_review',
      order_by: 'review_deadline',
      order_dir: 'asc',
      limit: 100,
    }),
    ArticleService.list({
      order_by: 'created_at',
      order_dir: 'desc',
      limit: 100,
    }),
  ]);

  const seen = new Set<string>();
  const rows = [...pending.rows, ...recent.rows].filter((article) => {
    if (seen.has(article.id)) return false;
    seen.add(article.id);
    return true;
  });

  return (
    <ActualitesAdminClient
      initialArticles={rows}
      initialTotal={Math.max(recent.total, rows.length)}
    />
  );
}

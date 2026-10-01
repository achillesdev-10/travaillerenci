import { ArticleService } from '@/services/articleService';
import ActualitesAdminClient from './ActualitesAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminActualitesPage() {
  const { rows, total } = await ArticleService.list({
    order_by: 'created_at',
    order_dir: 'desc',
    limit: 200,
  });

  return <ActualitesAdminClient initialArticles={rows} initialTotal={total} />;
}

import { EntreprendreArticleService } from '@/services/entreprendreService';
import EntreprendreAdminClient from './EntreprendreAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminEntreprendrePage() {
  const { rows } = await EntreprendreArticleService.list({
    order_by: 'created_at',
    order_dir: 'desc',
    limit: 200,
  });

  return <EntreprendreAdminClient initialArticles={rows} />;
}

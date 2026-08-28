import { EntreprendreCommentService } from '@/services/entreprendreService';
import CommentsAdminClient from './CommentsAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminCommentsPage() {
  const { rows } = await EntreprendreCommentService.list({
    limit: 200,
    offset: 0,
  });

  return <CommentsAdminClient initialComments={rows} />;
}

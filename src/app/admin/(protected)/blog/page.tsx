import { BlogService } from '@/services/blogService';
import BlogAdminClient from './BlogAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  const { rows } = await BlogService.list({
    order_by: 'created_at',
    order_dir: 'desc',
    limit: 200,
  });

  return <BlogAdminClient initialPosts={rows} />;
}

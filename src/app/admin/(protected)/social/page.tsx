import { SocialPostService } from '@/services/social/socialPostService';
import { getConnectionsStatus } from '@/services/social/socialConnection';
import { getSocialConfigSummary } from '@/services/social/config';
import SocialAdminClient from './SocialAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminSocialPage() {
  const [listing, stats, connections, config] = await Promise.all([
    SocialPostService.list({ limit: 200 }),
    SocialPostService.countByStatus(),
    getConnectionsStatus(),
    Promise.resolve(getSocialConfigSummary()),
  ]);

  return (
    <SocialAdminClient
      initialPosts={listing.rows}
      initialTotal={listing.total}
      initialStats={stats}
      initialConnections={connections}
      initialConfig={config}
    />
  );
}

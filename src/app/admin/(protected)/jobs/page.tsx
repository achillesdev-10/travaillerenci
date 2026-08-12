import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import AdminJobsClient from './AdminJobsClient';

export const dynamic = 'force-dynamic';

export default async function AdminJobsPage() {
  const [result, duplicates] = await Promise.all([
    JobOfferSchemaService.list({ limit: 200, order_by: 'created_at', order_dir: 'desc' }),
    JobOfferSchemaService.findDuplicates(),
  ]);

  return (
    <AdminJobsClient
      initialJobs={result.rows}
      duplicateIds={duplicates.map((d) => d.id)}
    />
  );
}

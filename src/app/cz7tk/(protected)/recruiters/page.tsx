import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import RecruiterOffersClient from './RecruiterOffersClient';

export const dynamic = 'force-dynamic';

export default async function RecruiterOffersPage() {
  const result = await JobOfferSchemaService.list({
    source_website: 'recruiter-self-service',
    limit: 200,
    order_by: 'created_at',
    order_dir: 'desc',
  });

  return <RecruiterOffersClient initialJobs={result.rows} />;
}

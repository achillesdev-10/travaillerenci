import ReportsAdminClient from './ReportsAdminClient';
import { ReportService } from '@/services/reportService';
import { resolveContentItem } from '@/lib/itemResolver';

export const dynamic = 'force-dynamic';

export default async function AdminReportsPage() {
  const [reports, counts] = await Promise.all([
    ReportService.list('all'),
    ReportService.countByStatus(),
  ]);

  const withContent = await Promise.all(
    reports.map(async (report) => ({
      ...report,
      content: await resolveContentItem(report.item_type, report.item_id),
    })),
  );

  return (
    <ReportsAdminClient
      initialReports={withContent}
      initialCounts={counts}
    />
  );
}

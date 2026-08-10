import AdminDashboardClient from "./AdminDashboardClient";
import { getAdminDashboardData } from "../../lib/admin-dashboard";
import { JobOfferSchemaService } from "@/services/jobOfferSchemaService";
import { ReportService } from "@/services/reportService";
import { resolveContentItem } from "@/lib/itemResolver";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [initialData, adminStats, reportCounts, pendingReports] = await Promise.all([
    getAdminDashboardData(),
    JobOfferSchemaService.getAdminStats(7),
    ReportService.countByStatus(),
    ReportService.list("pending", 5),
  ]);

  // Enrichit les 5 derniers signalements en attente (titre/lien du contenu
  // signalé) pour l'aperçu de la vue d'ensemble.
  const latestReports = await Promise.all(
    pendingReports.map(async (report) => ({
      ...report,
      content: await resolveContentItem(report.item_type, report.item_id),
    })),
  );

  return (
    <AdminDashboardClient
      initialData={initialData}
      activity={adminStats.activity}
      reportCounts={reportCounts}
      latestReports={latestReports}
    />
  );
}

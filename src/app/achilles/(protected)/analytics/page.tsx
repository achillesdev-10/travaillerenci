import { getAdminAnalyticsData } from "@/lib/admin-analytics";
import AnalyticsClient from "./AnalyticsClient";

export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const data = await getAdminAnalyticsData(14);

  return <AnalyticsClient initialData={data} />;
}

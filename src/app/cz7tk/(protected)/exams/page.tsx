import { ExamService } from '@/services/examService';
import ExamsAdminClient from './ExamsAdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminExamsPage() {
  // Publication automatique (21 min) : si l'admin ne s'est pas connecté, les
  // concours en attente depuis plus de 21 minutes sont validés et publiés
  // (même règle que les offres) — sinon la page /concours resterait à « 0 ».
  await ExamService.autoPublishPending();

  const [result, stats] = await Promise.all([
    ExamService.list({ limit: 200, order_by: 'created_at', order_dir: 'desc' }),
    ExamService.getAdminStats(),
  ]);

  return <ExamsAdminClient initialExams={result.rows} initialStats={stats} />;
}

import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import {
  getScraperHealth,
  getScraperRunHistory,
  triggerScraperRun,
} from "../../../../lib/admin-dashboard";

export const runtime = "nodejs";

/** État du scraper uniquement (polling 10 s côté client) — pas le dashboard. */
export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;
  const [scraperHealth, runHistory] = await Promise.all([
    getScraperHealth(),
    getScraperRunHistory(10),
  ]);
  return NextResponse.json({ scraperHealth, runHistory });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;
  try {
    const scraperHealth = await triggerScraperRun();

    revalidatePath("/cz7tk");
    revalidateTag("admin-dashboard", "max");

    // Notification admin si échec (fire-and-forget)
    if (scraperHealth.status === "error") {
      try {
        const { AdminNotificationService } = await import('@/services/adminNotificationService');
        await AdminNotificationService.create(
          'scraper_error',
          `Le scraper a échoué : ${scraperHealth.message || 'Erreur inconnue'}`,
          '/cz7tk/scraper',
        );
      } catch {
        // Silently ignore
      }
    }

    return NextResponse.json({
      scraperHealth,
      message: scraperHealth.message ?? "Le scraper a bien été déclenché.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Le scraper n'a pas pu être déclenché.",
      },
      { status: 500 },
    );
  }
}

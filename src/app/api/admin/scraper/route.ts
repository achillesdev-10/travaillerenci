import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import {
  getAdminDashboardData,
  getScraperRunHistory,
  triggerScraperRun,
} from "../../../../lib/admin-dashboard";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;
  const [payload, runHistory] = await Promise.all([
    getAdminDashboardData(),
    getScraperRunHistory(10),
  ]);
  return NextResponse.json({ ...payload, runHistory });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;
  try {
    const scraperHealth = await triggerScraperRun();

    revalidatePath("/cz7tk");

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

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { revalidateJobSurfaces } from '@/lib/revalidateContent';
import {
  applyBulkAction,
  getAdminDashboardData,
} from "../../../../../lib/admin-dashboard";

export const runtime = "nodejs";

type BulkRoutePayload = {
  action?: "delete" | "verify" | "archive";
  ids?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;
  try {
    const body = (await request.json()) as BulkRoutePayload;

    if (
      body.action !== "delete" &&
      body.action !== "verify" &&
      body.action !== "archive"
    ) {
      return NextResponse.json(
        { error: "Action en masse invalide." },
        { status: 400 },
      );
    }

    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      return NextResponse.json(
        { error: "Aucune offre sélectionnée." },
        { status: 400 },
      );
    }

    const ids = body.ids.map((id) => String(id));

    // Séquentiel : le dashboard doit refléter l'action qui vient d'être
    // appliquée (le cache est invalidé avant la relecture).
    const result = await applyBulkAction(body.action, ids);

    revalidateJobSurfaces(ids);
    revalidateTag("admin-dashboard", "max");

    const payload = await getAdminDashboardData();

    return NextResponse.json({
      ...payload,
      message: `${result.updated} offre${
        result.updated > 1 ? "s ont été traitées" : " a été traitée"
      }.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Impossible d'appliquer l'action en masse.",
      },
      { status: 500 },
    );
  }
}

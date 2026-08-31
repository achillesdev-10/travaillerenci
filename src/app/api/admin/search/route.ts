import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/adminSession";
import { JobOfferSchemaService } from "@/services/jobOfferSchemaService";
import { BlogService } from "@/services/blogService";
import { EntreprendreArticleService } from "@/services/entreprendreService";

/**
 * GET /api/admin/search?q=...
 *
 * Recherche globale admin : interroge en parallèle offres, blog,
 * entreprendre et affiche les résultats groupés par type (max 5/catégorie).
 */

type SearchResult = {
  type: "offer" | "blog" | "entreprendre";
  id: string;
  title: string;
  subtitle: string;
  link: string;
};

export async function GET(request: NextRequest) {
  const { error } = await requireAdminApi(request);
  if (error) return error;

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() || "";

  if (!query || query.length < 2) {
    return NextResponse.json({ results: { offers: [], blog: [], entreprendre: [] } });
  }

  const maxPerCategory = 5;

  // Recherche parallèle sur les 3 modules
  const [offersResult, blogResult, entreprendreResult] = await Promise.allSettled([
    searchOffers(query, maxPerCategory),
    searchBlog(query, maxPerCategory),
    searchEntreprendre(query, maxPerCategory),
  ]);

  return NextResponse.json({
    results: {
      offers: offersResult.status === "fulfilled" ? offersResult.value : [],
      blog: blogResult.status === "fulfilled" ? blogResult.value : [],
      entreprendre: entreprendreResult.status === "fulfilled" ? entreprendreResult.value : [],
    },
  });
}

async function searchOffers(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const { rows } = await JobOfferSchemaService.list({
      keyword: query,
      limit,
      offset: 0,
    });

    return rows.map((offer) => ({
      type: "offer" as const,
      id: offer.id,
      title: offer.title || "Offre sans titre",
      subtitle: `${offer.company || "Entreprise inconnue"} · ${offer.location || "Localisation inconnue"}`,
      link: `/cz7tk/jobs`,
    }));
  } catch {
    return [];
  }
}

async function searchBlog(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const { rows } = await BlogService.list({
      keyword: query,
      limit,
      offset: 0,
    });

    return rows.map((post) => ({
      type: "blog" as const,
      id: post.id,
      title: post.title,
      subtitle: post.excerpt?.slice(0, 80) || "Article de blog",
      link: `/cz7tk/blog`,
    }));
  } catch {
    return [];
  }
}

async function searchEntreprendre(query: string, limit: number): Promise<SearchResult[]> {
  try {
    const { rows } = await EntreprendreArticleService.list({
      keyword: query,
      limit,
      offset: 0,
    });

    return rows.map((article) => ({
      type: "entreprendre" as const,
      id: article.id,
      title: article.title,
      subtitle: `${article.sector} · ${article.excerpt?.slice(0, 60) || "Guide business"}`,
      link: `/cz7tk/entreprendre`,
    }));
  } catch {
    return [];
  }
}

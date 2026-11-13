"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { resolveTrafficSource } from "@/lib/trafficSource";
import { trackPageView } from "@/lib/analyticsClient";

/**
 * Source de trafic (§23) : calculée UNE fois par chargement de page, sur la
 * première navigation — les SPA suivantes ne changent pas l'origine du
 * visiteur. `document.referrer` n'est exploitable qu'au premier rendu.
 */
let cachedSource: string | null = null;

function trafficSource(): string {
  if (cachedSource) return cachedSource;
  try {
    const params = new URLSearchParams(window.location.search);
    cachedSource = resolveTrafficSource({
      utmSource: params.get("utm_source"),
      referrer: document.referrer,
      currentHost: window.location.hostname,
    });
  } catch {
    cachedSource = "direct";
  }
  return cachedSource;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname || pathname.startsWith("/cz7tk")) {
      return;
    }

    // Perf CPU : pas d'invocation /api/analytics/track pour les robots
    // connus (géré aussi dans analyticsClient, défense en profondeur).
    // La visite est regroupée avec les événements de la page en un seul POST.

    // CPU Vercel : une seule visite envoyée par page ET par session navigateur.
    // Les re-navigations internes (retour arrière, A/R entre listes et fiches)
    // ne déclenchent plus d'invocation /api/analytics/track inutile.
    const visitedKey = `visit:${pathname}`;
    try {
      if (sessionStorage.getItem(visitedKey)) return;
      sessionStorage.setItem(visitedKey, "1");
    } catch {
      // sessionStorage indisponible (navigation privée stricte) : on envoie
      // la visite normalement plutôt que de perdre la mesure.
    }

    // Envoi groupé non bloquant (visite + événements en attente).
    trackPageView(pathname, trafficSource());
  }, [pathname]);

  return null;
}

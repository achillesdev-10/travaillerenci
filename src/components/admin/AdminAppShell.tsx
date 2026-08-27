"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "./AdminSidebar";

const PAGE_TITLES: Array<{ prefix: string; title: string; subtitle: string }> = [
  { prefix: "/cz7tk/login", title: "Authentification", subtitle: "Connexion sécurisée" },
  { prefix: "/cz7tk/jobs", title: "Gestion des offres", subtitle: "Modération, SEO et publication" },
  { prefix: "/cz7tk/recruiters", title: "Offres Recruteurs", subtitle: "Modération des offres self-service" },
  { prefix: "/cz7tk/analytics", title: "Analytics", subtitle: "Audience et trafic du site" },
  { prefix: "/cz7tk/users", title: "Utilisateurs", subtitle: "Candidats et entreprises inscrits" },
  { prefix: "/cz7tk/reports", title: "Signalements", subtitle: "File de modération des contenus signalés" },
  { prefix: "/cz7tk/blog", title: "Gestion du blog", subtitle: "Articles et publications" },
  { prefix: "/cz7tk/scraper", title: "Scraper", subtitle: "Pilote des sources d'offres" },
  { prefix: "/cz7tk/settings", title: "Paramètres", subtitle: "Configuration de la plateforme" },
];

function getPageMeta(pathname: string) {
  for (const entry of PAGE_TITLES) {
    if (pathname.startsWith(entry.prefix)) {
      return entry;
    }
  }
  return { prefix: "/cz7tk", title: "Vue d'ensemble", subtitle: "KPIs, offres et santé du scraper" };
}

export default function AdminAppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Verrouille le scroll + ferme sur Échap quand le drawer mobile est ouvert.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
      }
    }

    if (mobileOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileOpen]);

  // Ferme le drawer à chaque changement de route.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMobileOpen(false);
  }, [pathname]);

  const meta = getPageMeta(pathname);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* ===== Sidebar Desktop (≥ lg) ===== */}
      <div className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
        <AdminSidebar email={email} />
      </div>

      {/* ===== Drawer Mobile (< lg) ===== */}
      <div
        className={[
          "fixed inset-0 z-40 transition-opacity duration-200 lg:hidden",
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none invisible opacity-0",
        ].join(" ")}
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        <div
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
        <div
          className={[
            "absolute inset-y-0 left-0 w-72 max-w-[85vw] transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          ].join(" ")}
        >
          <AdminSidebar email={email} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      {/* ===== Zone principale ===== */}
      <div className="flex min-h-screen flex-col lg:pl-72">
        {/* Header sticky */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/[0.06] bg-slate-950/85 px-4 backdrop-blur-md sm:px-6">
          <div className="flex items-center gap-3">
            {/* Hamburger mobile */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu de navigation"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white lg:hidden"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 6h16" />
                <path d="M4 12h16" />
                <path d="M4 18h16" />
              </svg>
            </button>

            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-white">{meta.title}</div>
              <div className="text-[11px] text-slate-500">{meta.subtitle}</div>
            </div>
            <div className="sm:hidden">
              <div className="text-sm font-semibold text-white">Admin</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 md:inline-flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-300">Rôle Admin</span>
            </div>
            <div className="hidden text-right sm:block">
              <div className="max-w-[180px] truncate text-xs font-semibold text-white">{email}</div>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-lg shadow-emerald-500/20">
              {email.charAt(0).toUpperCase()}
            </div>
          </div>
        </header>

        {/* Contenu */}
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

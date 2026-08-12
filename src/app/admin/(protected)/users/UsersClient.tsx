"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AdminUsersData, AdminUserRole } from "@/lib/admin-users";

type UsersClientProps = {
  initialData: AdminUsersData;
};

const ROLE_OPTIONS: Array<{ value: AdminUserRole | "all"; label: string }> = [
  { value: "all", label: "Tous les rôles" },
  { value: "candidate", label: "Candidats" },
  { value: "company", label: "Entreprises" },
  { value: "admin", label: "Administrateurs" },
];

function formatDate(date: string | null) {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(parsed);
}

function roleLabel(role: AdminUserRole) {
  switch (role) {
    case "candidate":
      return "Candidat";
    case "company":
      return "Entreprise";
    case "admin":
      return "Admin";
    default:
      return "Inconnu";
  }
}

function roleClasses(role: AdminUserRole) {
  switch (role) {
    case "candidate":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "company":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    case "admin":
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
    default:
      return "border-white/10 bg-white/[0.04] text-slate-400";
  }
}

function sourceBadge(data: AdminUsersData) {
  switch (data.source) {
    case "supabase":
      return {
        label: "Source : Supabase",
        cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
      };
    case "sqlite":
      return {
        label: "Source : base locale",
        cls: "border-sky-500/30 bg-sky-500/10 text-sky-300",
      };
    default:
      return {
        label: "Aucune donnée",
        cls: "border-white/10 bg-white/[0.04] text-slate-400",
      };
  }
}

function Avatar({ name, email }: { name: string | null; email: string }) {
  const letter = (name || email || "?").charAt(0).toUpperCase();
  return (
    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-lg shadow-emerald-500/20">
      {letter}
    </span>
  );
}

export default function UsersClient({ initialData }: UsersClientProps) {
  const router = useRouter();
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUserRole | "all">("all");
  const [isPending, startTransition] = useTransition();
  const [refreshError, setRefreshError] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshError(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      if (res.status === 401) {
        router.replace("/admin/login?next=/admin/users");
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Impossible d'actualiser la liste.");
      }
      const payload = (await res.json()) as AdminUsersData;
      setData(payload);
    } catch (err) {
      setRefreshError(err instanceof Error ? err.message : "Erreur inconnue.");
    }
  }

  const badge = sourceBadge(data);

  const statCards: Array<{
    label: string;
    value: number;
    hint: string;
    accent: string;
    icon: React.ReactNode;
  }> = [
    {
      label: "Inscrits totaux",
      value: data.total,
      hint: "Comptes enregistrés",
      accent: "from-emerald-500 to-teal-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
          <circle cx="17.5" cy="9" r="2.5" />
          <path d="M16 14.6a5 5 0 0 1 5.5 5" />
        </svg>
      ),
    },
    {
      label: "Candidats",
      value: data.candidates,
      hint: "Chercheurs d'emploi",
      accent: "from-sky-500 to-blue-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
        </svg>
      ),
    },
    {
      label: "Entreprises",
      value: data.companies,
      hint: "Recruteurs inscrits",
      accent: "from-amber-500 to-orange-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M4 9h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9Z" />
          <path d="M4 12h16" />
        </svg>
      ),
    },
    {
      label: "Administrateurs",
      value: data.admins,
      hint: "Comptes privilégiés",
      accent: "from-fuchsia-500 to-purple-600",
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 5 6v5c0 4.5 3 8.5 7 10 4-1.5 7-5.5 7-10V6l-7-3Z" />
          <path d="m9.5 12 2 2 3.5-3.5" />
        </svg>
      ),
    },
  ];

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.users.filter((user) => {
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesSearch =
        !query ||
        user.email.toLowerCase().includes(query) ||
        (user.name ?? "").toLowerCase().includes(query);
      return matchesRole && matchesSearch;
    });
  }, [data.users, roleFilter, search]);

  return (
    <div className="space-y-6">
      {/* ===== En-tête ===== */}
      <section className="rounded-3xl border border-white/[0.06] bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-400">
              Communauté inscrite
            </p>
            <h1 className="mt-1 font-[var(--font-display)] text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              Utilisateurs inscrits
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Tous les candidats et entreprises qui ont créé un compte sur
              TravaillerenCi.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
            <button
              type="button"
              onClick={() => startTransition(() => void handleRefresh())}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg
                className={`h-4 w-4 ${isPending ? "animate-spin" : ""}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <path d="M21 3v6h-6" />
              </svg>
              {isPending ? "Actualisation..." : "Actualiser"}
            </button>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${badge.cls}`}
            >
              {badge.label}
            </span>
          </div>
        </div>

        {refreshError ? (
          <div className="mt-5 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            {refreshError}
          </div>
        ) : null}

        {data.note ? (
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
            {data.note}
          </div>
        ) : null}
      </section>

      {/* ===== Stats ===== */}
      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {statCards.map((card) => (
          <article
            key={card.label}
            className="hover-lift rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-slate-400">{card.label}</p>
              <span
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg ${card.accent}`}
              >
                {card.icon}
              </span>
            </div>
            <p className="mt-4 font-[var(--font-display)] text-3xl font-black tracking-tight text-white sm:text-4xl">
              {card.value}
            </p>
            <p className="mt-2 text-xs text-slate-500">{card.hint}</p>
          </article>
        ))}
      </section>

      {/* ===== Filtres ===== */}
      <section className="rounded-3xl border border-white/[0.06] bg-slate-900/60 p-5 shadow-lg shadow-black/20 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-[var(--font-display)] text-lg font-bold text-white">
              Liste des comptes
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {filteredUsers.length} utilisateur{filteredUsers.length > 1 ? "s" : ""} sur{" "}
              {data.total}.
            </p>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 md:max-w-xl">
            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-medium text-slate-500">Rechercher</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Email ou nom..."
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
              />
            </label>

            <label className="space-y-1.5 text-sm">
              <span className="text-xs font-medium text-slate-500">Rôle</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as AdminUserRole | "all")}
                className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-500/50"
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-950">
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {/* ===== Vue cartes (mobile < md) ===== */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 md:hidden">
          {filteredUsers.length === 0 ? (
            <p className="rounded-2xl border border-white/[0.06] bg-slate-950/60 px-4 py-10 text-center text-sm text-slate-500 sm:col-span-2">
              Aucun utilisateur ne correspond aux filtres actuels.
            </p>
          ) : null}
          {filteredUsers.map((user) => (
            <article
              key={user.id}
              className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4"
            >
              <div className="flex items-center gap-3">
                <Avatar name={user.name} email={user.email} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">
                    {user.name ?? "—"}
                  </div>
                  <div className="truncate text-xs text-slate-400">{user.email}</div>
                </div>
                <span
                  className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${roleClasses(
                    user.role,
                  )}`}
                >
                  {roleLabel(user.role)}
                </span>
              </div>
              {user.headline ? (
                <p className="mt-3 line-clamp-2 text-xs text-slate-500">{user.headline}</p>
              ) : null}
              <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3 text-xs text-slate-500">
                <span>Inscrit : {formatDate(user.created_at)}</span>
                {user.website ? (
                  <a
                    href={user.website.startsWith("http") ? user.website : `https://${user.website}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-emerald-400 hover:text-emerald-300"
                  >
                    Site ↗
                  </a>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        {/* ===== Table desktop (≥ md) ===== */}
        <div className="mt-5 hidden overflow-hidden rounded-2xl border border-white/[0.06] md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-white/[0.06] text-left">
              <thead className="bg-slate-950/80">
                <tr className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                  <th className="px-4 py-4">Utilisateur</th>
                  <th className="px-4 py-4">Email</th>
                  <th className="px-4 py-4">Rôle</th>
                  <th className="px-4 py-4">Titre / Site</th>
                  <th className="px-4 py-4">Inscrit le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] bg-slate-900/40">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-slate-500">
                      Aucun utilisateur ne correspond aux filtres actuels.
                    </td>
                  </tr>
                ) : null}
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="transition hover:bg-white/[0.03]">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={user.name} email={user.email} />
                        <span className="font-medium text-white">{user.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-300">{user.email}</td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${roleClasses(
                          user.role,
                        )}`}
                      >
                        {roleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {user.headline ? (
                        <span className="block max-w-[260px] truncate text-sm text-slate-400">
                          {user.headline}
                        </span>
                      ) : user.website ? (
                        <a
                          href={user.website.startsWith("http") ? user.website : `https://${user.website}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-medium text-emerald-400 hover:text-emerald-300"
                        >
                          {user.website}
                        </a>
                      ) : (
                        <span className="text-sm text-slate-600">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-300">
                      {formatDate(user.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

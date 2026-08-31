"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type SearchResult = {
  type: "offer" | "blog" | "entreprendre";
  id: string;
  title: string;
  subtitle: string;
  link: string;
};

type SearchResults = {
  offers: SearchResult[];
  blog: SearchResult[];
  entreprendre: SearchResult[];
};

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  offer: { label: "Offres", color: "text-emerald-400" },
  blog: { label: "Blog", color: "text-sky-400" },
  entreprendre: { label: "Entreprendre", color: "text-violet-400" },
};

export default function AdminSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>({ offers: [], blog: [], entreprendre: [] });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Cmd/Ctrl+K shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setResults({ offers: [], blog: [], entreprendre: [] });
    }
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults({ offers: [], blog: [], entreprendre: [] });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || { offers: [], blog: [], entreprendre: [] });
      }
    } catch {
      // ignore
    }
    setLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => void search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const totalResults =
    results.offers.length + results.blog.length + results.entreprendre.length;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="hidden sm:inline">Rechercher…</span>
        <kbd className="hidden rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 md:inline">
          ⌘K
        </kbd>
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setOpen(false)} />

          <div
            ref={panelRef}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3">
              <svg className="h-5 w-5 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher offres, articles, guides…"
                className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
              )}
              <kbd className="rounded border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-96 overflow-y-auto">
              {query.length < 2 ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  Tapez au moins 2 caractères pour lancer la recherche.
                </div>
              ) : totalResults === 0 && !loading ? (
                <div className="px-4 py-10 text-center text-sm text-slate-500">
                  Aucun résultat pour « {query} ».
                </div>
              ) : (
                <div className="py-2">
                  {(Object.keys(CATEGORY_LABELS) as Array<keyof SearchResults>).map((type) => {
                    const items = results[type] || [];
                    if (items.length === 0) return null;
                    const meta = CATEGORY_LABELS[type];

                    return (
                      <div key={type}>
                        <div className="px-4 py-2">
                          <span className={`text-[11px] font-semibold uppercase tracking-wider ${meta.color}`}>
                            {meta.label}
                          </span>
                          <span className="ml-2 text-[11px] text-slate-500">
                            {items.length} résultat{items.length > 1 ? "s" : ""}
                          </span>
                        </div>
                        <ul>
                          {items.map((item: SearchResult) => (
                            <li key={item.id}>
                              <Link
                                href={item.link}
                                onClick={() => setOpen(false)}
                                className="block px-4 py-2.5 transition-colors hover:bg-white/[0.04]"
                              >
                                <p className="text-sm font-medium text-white">{item.title}</p>
                                <p className="mt-0.5 text-xs text-slate-500">{item.subtitle}</p>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

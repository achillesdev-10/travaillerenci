import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ExamService } from '@/services/examService';
import ExamCard from '@/components/exams/ExamCard';
import CategoryIcon from '@/components/exams/CategoryIcon';
import PhaseSection, { groupExamsByPhase, SECTION_LIMIT } from '@/components/exams/PhaseSection';
import ConcoursTicker from '@/components/concours/ConcoursTicker';
import ConcoursFilters from '@/components/concours/ConcoursFilters';
import ConcoursTabSection from './_components/ConcoursTabSection';
import PWAInstallCTA from '@/components/concours/PWAInstallCTA';
import {
  EXAM_CATEGORIES,
  EXAM_CATEGORY_LABEL,
  EXAM_PHASE_LABEL,
  examPhase,
} from '@/lib/examConstants';
import { DIPLOMA_SEO } from '@/lib/examSeo';
import { getSiteUrl } from '@/lib/site';
import type { ExamPhase } from '@/types/exam';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Concours administratifs en Côte d\'Ivoire',
  description:
    'Consultez les derniers concours administratifs, examens professionnels et recrutements de la fonction publique ivoirienne : dates, conditions d\'éligibilité et modalités de candidature.',
  keywords: [
    'concours',
    'concours administratifs',
    'côte d\'ivoire',
    'fonction publique',
    'ENA',
    'INFAS',
    'CAFOP',
    'gendarmerie',
    'recrutement',
  ],
  alternates: {
    canonical: `${getSiteUrl()}/concours`,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    url: `${getSiteUrl()}/concours`,
    siteName: 'TravaillerenCi',
    title: 'Concours administratifs en Côte d\'Ivoire | TravaillerEnCi',
    description:
      'Tous les concours de la fonction publique ivoirienne centralisés : dates d\'inscription, conditions d\'éligibilité et liens officiels.',
  },
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 18;

/** Filtres de phase groupés utilisés par les liens « Voir tout » des sections. */
const PHASE_GROUPS: Record<'current' | 'past', ExamPhase[]> = {
  current: ['open', 'ongoing'],
  past: ['closed', 'results'],
};
const PHASE_GROUP_LABEL: Record<'current' | 'past', string> = {
  current: 'En cours',
  past: 'Clos & résultats',
};

type PhaseFilter = ExamPhase | keyof typeof PHASE_GROUPS | '';

/** Phases acceptées dans l'URL (phases simples + groupes) — dérivé des constantes. */
const VALID_PHASES = new Set<string>([
  ...Object.keys(EXAM_PHASE_LABEL),
  ...Object.keys(PHASE_GROUPS),
]);


interface ConcoursPageProps {
  searchParams: Promise<{
    q?: string;
    organizer?: string;
    category?: string;
    diploma?: string;
    phase?: string;
    page?: string;
    tab?: string;
  }>;
}

export default async function ConcoursPage({ searchParams }: ConcoursPageProps) {
  const sp = await searchParams;
  const keyword = sp.q || '';
  const organizer = sp.organizer || '';
  const category = sp.category || '';
  const diploma = sp.diploma || '';
  const rawPhase = sp.phase || '';
  const phase = (VALID_PHASES.has(rawPhase) ? rawPhase : '') as PhaseFilter;
  const activeTab = sp.tab || 'concours';
  const page = Math.max(1, Number(sp.page) || 1);

  const [, all] = await Promise.all([
    ExamService.listOrganizers(),
    ExamService.list({
      keyword,
      organizer,
      category: category ? (category as any) : undefined,
      diploma,
      status: 'published',
      order_by: 'created_at',
      order_dir: 'desc',
      limit: phase ? 500 : 200,
    }),
  ]);

  let rows = all.rows;
  let total = all.total;
  const totalRecensed = all.total;

  const grouped = groupExamsByPhase(rows);
  if (phase) {
    const phases = PHASE_GROUPS[phase as keyof typeof PHASE_GROUPS] ?? [phase as ExamPhase];
    rows = rows.filter((e) => phases.includes(examPhase(e)));
    total = rows.length;
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedRows = phase
    ? rows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    : [];

  // Counts for tabs
  const concoursCount = totalRecensed;
  // Communiqués = concours avec results ou closed
  const communiquesCount = grouped.past.length;
  // Actus = guides (simulate — would come from articles in production)
  const actusCount = 0;

  function filterHref(params: Record<string, string | undefined>) {
    const url = new URLSearchParams();
    const next = { q: keyword, organizer, category, diploma, phase, ...params };
    Object.entries(next).forEach(([k, v]) => {
      if (v) url.set(k, v);
      else url.delete(k);
    });
    const qs = url.toString();
    return `/concours${qs ? `?${qs}` : ''}`;
  }

  return (
    <main className="flex-1 min-h-screen bg-gray-50 py-8 transition-colors dark:bg-slate-950 sm:py-12">
      <div className="container mx-auto max-w-6xl px-4">
        {/* ===================== HÉRO ===================== */}
        <section className="relative overflow-hidden mb-6 rounded-2xl bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 shadow-md">
          <div className="relative p-5 sm:p-7">
            <nav
              aria-label="Fil d'Ariane"
              className="mb-3 text-sm text-gray-500 dark:text-gray-400"
            >
              <Link href="/" className="hover:text-primary">Accueil</Link>
              <span className="mx-2" aria-hidden="true">/</span>
              <span className="font-medium text-gray-900 dark:text-white">Concours administratifs</span>
            </nav>

            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary dark:text-emerald-400 border border-primary/20">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Sources officielles
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/10 px-3 py-1 text-[11px] font-bold text-orange-600 dark:text-orange-400 border border-orange-500/20">
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Mis à jour automatiquement
              </span>
            </div>

            <h1 className="mb-2 font-[var(--font-display)] text-2xl font-extrabold leading-tight sm:text-3xl text-gray-900 dark:text-white">
              Concours administratifs en Côte d&apos;Ivoire
            </h1>
            <p className="max-w-xl text-sm text-gray-600 dark:text-gray-300 sm:text-base mb-4">
              Retrouvez les concours <strong className="text-gray-900 dark:text-white">en cours</strong> et{' '}
              <strong className="text-gray-900 dark:text-white">à venir</strong> de la fonction publique et des
              grandes écoles ivoiriennes (ENA, INFAS, CAFOP, gendarmerie…), alimentés
              directement depuis les sources officielles.
            </p>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                <div>
                  <div className="font-[var(--font-display)] text-xl font-black text-gray-900 dark:text-white">{totalRecensed}</div>
                  <div className="text-[11px] uppercase tracking-widest text-gray-500 dark:text-gray-400">concours recensés</div>
                </div>
                <div>
                  <div className="font-[var(--font-display)] text-xl font-black text-gray-900 dark:text-white">10+</div>
                  <div className="text-[11px] uppercase tracking-widest text-gray-500 dark:text-gray-400">sources officielles</div>
                </div>
                <div>
                  <div className="font-[var(--font-display)] text-xl font-black text-gray-900 dark:text-white">100 %</div>
                  <div className="text-[11px] uppercase tracking-widest text-gray-500 dark:text-gray-400">relu avant publication</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary text-white px-4 py-2 text-sm font-bold shadow-md shadow-primary/20 hover:bg-primary-dark hover:shadow-lg transition-all"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="19" y1="8" x2="19" y2="14" />
                    <line x1="22" y1="11" x2="16" y2="11" />
                  </svg>
                  S'inscrire — c'est gratuit
                </Link>
                <Link
                  href="/jobs"
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 px-4 py-2 text-sm font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-all"
                >
                  Voir les offres d'emploi
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ===================== TICKER / ALERTE DÉFILANTE ===================== */}
        <div className="mb-6">
          <ConcoursTicker exams={all.rows} />
        </div>

        {/* ===================== FILTRES DYNAMIQUES (Selects) ===================== */}
        <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-4 shadow-md shadow-black/5 dark:border-slate-800 dark:bg-slate-900 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Filtrer les concours
            </span>
          </div>
          <Suspense fallback={<ConcoursFiltersSkeleton />}>
            <ConcoursFilters
              initialDiploma={diploma}
              initialCategory={category}
              initialPhase={rawPhase}
            />
          </Suspense>
        </div>

        {/* ===================== CALENDRIER DES CONCOURS ADMINISTRATIFS ===================== */}
        <div className="mb-6 rounded-2xl border border-indigo-100 bg-white p-5 shadow-md shadow-black/5 dark:border-indigo-900/30 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            <div>
              <h3 className="font-[var(--font-display)] text-sm font-bold text-gray-900 dark:text-white">Calendrier des concours administratifs</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">Sessions & rappels — très recherché en période de session</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { name: 'ENA', full: "École Nationale d'Administration", color: 'bg-emerald-50 text-emerald-700 border-emerald-200', darkColor: 'dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/40', icon: '🏛️' },
              { name: 'Fonction Publique', full: 'Concours de la Fonction Publique', color: 'bg-orange-50 text-orange-700 border-orange-200', darkColor: 'dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800/40', icon: '🏢' },
              { name: 'CAFOP', full: "Centres d'Animation de Formation P\u00e9dagogique", color: 'bg-blue-50 text-blue-700 border-blue-200', darkColor: 'dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/40', icon: '🎓' },
            ].map((item) => (
              <Link
                key={item.name}
                href={`/concours?q=${encodeURIComponent(item.name)}`}
                className={`group rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${item.color} ${item.darkColor}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-lg" aria-hidden="true">{item.icon}</span>
                  <span className="font-[var(--font-display)] text-sm font-bold">{item.name}</span>
                </div>
                <p className="text-[11px] opacity-80 leading-snug line-clamp-2">{item.full}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100">
                  Voir les sessions
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500 text-center">
            🔔 Activez une alerte pour recevoir les dates d'inscription par email
          </p>
        </div>

        {/* ===================== PWA CTA — Bannière ===================== */}
        <div className="mb-6">
          <PWAInstallCTA variant="banner" />
        </div>

        {/* ===================== SYSTÈME D'ONGLETS ===================== */}
        <ConcoursTabSection
          activeTab={activeTab}
          counts={{ concours: concoursCount, communiques: communiquesCount, actualites: actusCount }}
        >
          {/* ===================== ONGLET 1 : CONCOURS ===================== */}
          {activeTab === 'concours' && (
            <>
              {/* Explorer par catégorie / par diplôme — pages SEO (maillage interne) */}
              <section aria-label="Explorer par catégorie ou par diplôme" className="mb-6">
                <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Explorer par catégorie
                </p>
                <div className="flex flex-wrap gap-2">
                  {EXAM_CATEGORIES.map((c) => (
                    <Link
                      key={c.value}
                      href={`/concours/categorie/${c.value}`}
                      className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                    >
                      <CategoryIcon category={c.value} className="h-3.5 w-3.5" />
                      {c.label}
                    </Link>
                  ))}
                </div>
                <p className="mb-2 mt-4 text-[11px] font-bold uppercase tracking-widest text-gray-400">
                  Par diplôme
                </p>
                <div className="flex flex-wrap gap-2">
                  {DIPLOMA_SEO.map((d) => (
                    <Link
                      key={d.slug}
                      href={`/concours/diplome/${d.slug}`}
                      className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                    >
                      {d.label}
                    </Link>
                  ))}
                </div>
              </section>

              {/* Compteur */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-[var(--font-display)] text-xl font-bold text-gray-900 dark:text-white">
                  {total} concours recensé{total > 1 ? 's' : ''}
                  {keyword || organizer || category || diploma || phase ? ' (filtrés)' : ''}
                </h2>
                {category && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Catégorie : {EXAM_CATEGORY_LABEL[category as keyof typeof EXAM_CATEGORY_LABEL] ?? category}
                    {phase
                      ? ` · ${PHASE_GROUP_LABEL[phase as keyof typeof PHASE_GROUP_LABEL] ?? EXAM_PHASE_LABEL[phase as ExamPhase]}`
                      : ''}
                  </span>
                )}
              </div>

              {/* Résultats */}
              {phase ? (
                <>
                  {pagedRows.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
                      {pagedRows.map((exam) => (
                        <ExamCard key={exam.id} exam={exam} priority={safePage === 1} />
                      ))}
                    </div>
                  ) : (
                    <ConcoursEmptyState />
                  )}

                  {/* Pagination (vue filtrée par phase uniquement) */}
                  {totalPages > 1 && (
                    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
                      {safePage > 1 && (
                        <Link
                          href={filterHref({ page: String(safePage - 1) })}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                        >
                          ← Précédent
                        </Link>
                      )}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                        .reduce<number[]>((acc, p) => {
                          if (acc.length && p - acc[acc.length - 1] > 1) acc.push(-1);
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === -1 ? (
                            <span key={`gap-${i}`} className="px-1 text-gray-400">…</span>
                          ) : (
                            <Link
                              key={p}
                              href={filterHref({ page: String(p) })}
                              aria-current={p === safePage ? 'page' : undefined}
                              className={cn(
                                'rounded-xl px-4 py-2 text-sm font-semibold transition-colors',
                                p === safePage
                                  ? 'bg-primary text-white shadow-md shadow-primary/20'
                                  : 'border border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
                              )}
                            >
                              {p}
                            </Link>
                          ),
                        )}
                      {safePage < totalPages && (
                        <Link
                          href={filterHref({ page: String(safePage + 1) })}
                          className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                        >
                          Suivant →
                        </Link>
                      )}
                    </nav>
                  )}
                </>
              ) : (
                <>
                  <PhaseSection
                    title="Concours en cours"
                    subtitle="Inscriptions ouvertes ou épreuves en cours"
                    accent="emerald"
                    exams={grouped.current}
                    limit={SECTION_LIMIT}
                    viewAllHref={filterHref({ phase: 'current', page: undefined })}
                    viewAllLabel="Voir tout"
                  />
                  <PhaseSection
                    title="Concours à venir"
                    subtitle="Annoncés — inscriptions pas encore ouvertes"
                    accent="indigo"
                    exams={grouped.upcoming}
                    limit={SECTION_LIMIT}
                    viewAllHref={filterHref({ phase: 'upcoming', page: undefined })}
                    viewAllLabel="Voir tout"
                  />
                  <PhaseSection
                    title="Concours clos & résultats"
                    subtitle="Archives des sessions passées"
                    accent="slate"
                    exams={grouped.past}
                    limit={SECTION_LIMIT}
                    viewAllHref={filterHref({ phase: 'past', page: undefined })}
                    viewAllLabel="Voir tout"
                  />
                  {grouped.current.length === 0 &&
                    grouped.upcoming.length === 0 &&
                    grouped.past.length === 0 && <ConcoursEmptyState />}
                </>
              )}
            </>
          )}

          {/* ===================== ONGLET 2 : COMMUNIQUÉS ===================== */}
          {activeTab === 'communiques' && (
            <section>
              <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
                  Communiqués officiels &amp; Résultats
                </h2>
                <p className="max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 mb-6">
                  Retrouvez ici les communiqués officiels des institutions publiant des
                  concours, ainsi que les résultats des sessions récentes.
                </p>

                {/* Concours avec résultats publiés */}
                {grouped.past.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
                    {grouped.past.slice(0, SECTION_LIMIT).map((exam) => (
                      <ExamCard key={exam.id} exam={exam} priority={false} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-slate-700 dark:bg-slate-800/50">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Aucun communiqué ou résultat disponible pour le moment.
                    </p>
                  </div>
                )}

                {/* Lien « Voir tous les concours clos & résultats » */}
                {grouped.past.length > SECTION_LIMIT && (
                  <div className="mt-6 text-center">
                    <Link
                      href={filterHref({ phase: 'past', page: undefined })}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                    >
                      Voir tous les résultats
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </Link>
                  </div>
                )}
              </div>

              {/* Source officielle */}
              <div className="rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
                  Des informations vérifiées, directement à la source
                </h2>
                <p className="max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                  Chaque concours est collecté auprès des institutions officielles ivoiriennes
                  (Ministère de la Fonction Publique, ENA, Ministère de la Défense, INFAS, INJS,
                  CAFOP/DECO, INSFS…) puis relu par notre équipe avant publication.
                </p>
              </div>
            </section>
          )}

          {/* ===================== ONGLET 3 : ACTUALITÉS & GUIDES ===================== */}
          {activeTab === 'actualites' && (
            <section>
              <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
                  Actualités &amp; Guides de préparation
                </h2>
                <p className="max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-300 mb-6">
                  Conseils, méthodes de préparation et actualités du marché de
                  l&apos;emploi en Côte d&apos;Ivoire.
                </p>

                {/* Placeholder cards */}
                <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
                  <GuideCard
                    title="Comment préparer le concours de l'ENA"
                    excerpt="Guide complet pour réussir les épreuves d'admission à l'École Nationale d'Administration."
                    category="Guide"
                  />
                  <GuideCard
                    title="Les métiers porteurs en 2025 en Côte d'Ivoire"
                    excerpt="Découvrez les secteurs qui recrutent massivement et les compétences recherchées."
                    category="Actualité"
                  />
                  <GuideCard
                    title="CV parfait pour un concours administratif"
                    excerpt="Modèle et conseils pour un CV qui retient l'attention du jury."
                    category="Guide"
                  />
                </div>

                <div className="mt-6 text-center">
                  <Link
                    href="/actualites"
                    className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Voir toutes les actualités
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* PWA CTA intégré dans les guides */}
              <PWAInstallCTA variant="default" className="mt-6" />
            </section>
          )}
        </ConcoursTabSection>

        {/* ===================== PWA CTA — Fin de page ===================== */}
        <div className="mt-8">
          <PWAInstallCTA variant="default" />
        </div>

        {/* Bloc sources officielles (crédibilité + SEO) — seulement si pas dans onglet communiqués */}
        {activeTab !== 'communiques' && (
          <section className="mt-12 rounded-2xl border border-gray-100 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
            <h2 className="mb-3 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
              Des informations vérifiées, directement à la source
            </h2>
            <p className="max-w-3xl text-sm leading-relaxed text-gray-600 dark:text-gray-300">
              Chaque concours est collecté auprès des institutions officielles ivoiriennes
              (Ministère de la Fonction Publique, ENA, Ministère de la Défense, INFAS, INJS,
              CAFOP/DECO, INSFS…) puis relu par notre équipe avant publication. La fiche de
              chaque concours renvoie toujours vers le communiqué officiel d&apos;origine, pour
              une information transparente et fiable.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

// -----------------------------------------------------------------------------
//  Sous-composants
// -----------------------------------------------------------------------------

function ConcoursEmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900 sm:p-12">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50 dark:bg-slate-800 sm:h-20 sm:w-20">
        <svg className="h-8 w-8 text-gray-400 sm:h-10 sm:w-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z" />
        </svg>
      </div>
      <h3 className="mb-2 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
        Aucun concours ne correspond à vos critères
      </h3>
      <p className="mx-auto mb-6 max-w-md text-sm text-gray-500 dark:text-gray-400 sm:text-base">
        Modifiez vos filtres ou réinitialisez la recherche. Les nouveaux avis
        de concours apparaissent après validation par notre équipe.
      </p>
      <Link
        href="/concours"
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-primary-dark"
      >
        Voir tous les concours
      </Link>
    </div>
  );
}

/** Carte de guide (placeholder pour onglet Actualités). */
function GuideCard({
  title,
  excerpt,
  category,
}: {
  title: string;
  excerpt: string;
  category: string;
}) {
  return (
    <div className="flex flex-col bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-1 hover:border-primary/30 transition-all duration-200 cursor-pointer">
      <div className="h-28 bg-gradient-to-br from-primary/5 to-emerald-500/5 dark:from-primary/10 dark:to-emerald-500/10 flex items-center justify-center">
        <svg className="h-12 w-12 text-primary/30 dark:text-emerald-400/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2" />
          <path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z" />
        </svg>
      </div>
      <div className="flex flex-col flex-1 p-4">
        <span className="inline-flex items-center rounded-full bg-primary/10 text-primary dark:text-emerald-400 px-2 py-0.5 text-[10.5px] font-bold w-fit mb-2">
          {category}
        </span>
        <h3 className="text-[13px] sm:text-[15px] font-bold text-gray-900 dark:text-white leading-snug mb-1 line-clamp-2">
          {title}
        </h3>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 flex-1">
          {excerpt}
        </p>
        <div className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-primary">
          Lire
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/** Skeleton pour les filtres concours (fallback Suspense). */
function ConcoursFiltersSkeleton() {
  return (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex-1 min-w-0">
          <div className="mb-1 h-3 w-20 rounded bg-gray-100 dark:bg-slate-800" />
          <div className="h-10 rounded-xl bg-gray-100 dark:bg-slate-800" />
        </div>
      ))}
    </div>
  );
}

import Link from 'next/link';
import type { Exam } from '@/types/exam';
import { examPhase } from '@/lib/examConstants';
import ExamCard from '@/components/exams/ExamCard';

/** Nombre max de cartes affichées par section avant le lien « Voir tout ». */
export const SECTION_LIMIT = 12;

const PHASE_SECTION_ACCENTS = {
  emerald: {
    dot: 'bg-brand',
    ring: 'bg-brand/10 text-brand dark:text-brand-accent border-brand/30',
    bar: 'bg-brand',
  },
  indigo: {
    dot: 'bg-indigo-500',
    ring: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
    bar: 'bg-indigo-500',
  },
  slate: {
    dot: 'bg-slate-400',
    ring: 'bg-slate-500/10 text-black dark:text-white border-slate-500/30',
    bar: 'bg-slate-400',
  },
} as const;

/**
 * Regroupe une liste de concours publiés par phase « métier » :
 *  - current  : inscriptions ouvertes / épreuves en cours (open + ongoing)
 *  - upcoming : annoncés, inscriptions pas encore ouvertes
 *  - past     : clos & résultats publiés
 */
export function groupExamsByPhase(exams: Exam[]): {
  current: Exam[];
  upcoming: Exam[];
  past: Exam[];
} {
  const current: Exam[] = [];
  const upcoming: Exam[] = [];
  const past: Exam[] = [];
  for (const e of exams) {
    const p = examPhase(e);
    if (p === 'upcoming') upcoming.push(e);
    else if (p === 'closed' || p === 'results') past.push(e);
    else current.push(e);
  }
  return { current, upcoming, past };
}

export default function PhaseSection({
  title,
  subtitle,
  accent,
  exams,
  limit = 0,
  viewAllHref,
  viewAllLabel = 'Voir tout',
}: {
  title: string;
  subtitle: string;
  accent: keyof typeof PHASE_SECTION_ACCENTS;
  exams: Exam[];
  /** Nombre max de cartes affichées ; 0 = tout afficher. */
  limit?: number;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  if (exams.length === 0) return null;
  const a = PHASE_SECTION_ACCENTS[accent];
  const capped = limit > 0 && exams.length > limit;
  const visible = capped ? exams.slice(0, limit) : exams;

  return (
    <section aria-label={title} className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className={`h-2.5 w-2.5 rounded-full ${a.dot}`} aria-hidden="true" />
          <div>
            <h2 className="font-[var(--font-display)] text-lg font-bold text-black dark:text-white sm:text-xl">
              {title}
            </h2>
            <p className="text-xs text-black dark:text-white sm:text-sm">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {capped && viewAllHref && (
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary transition-all hover:gap-2 hover:underline sm:text-sm"
            >
              {viewAllLabel}
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          )}
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${a.ring}`}
          >
            {exams.length} concours
          </span>
        </div>
      </div>
      <div className={`mb-2 h-0.5 w-16 rounded-full ${a.bar}`} aria-hidden="true" />
      <div className="grid grid-cols-2 gap-3 sm:gap-6 lg:grid-cols-3">
        {visible.map((exam) => (
          <ExamCard key={exam.id} exam={exam} priority={false} />
        ))}
      </div>
    </section>
  );
}

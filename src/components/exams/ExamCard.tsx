import Link from 'next/link';
import type { Exam } from '@/types/exam';
import {
  EXAM_CATEGORY_LABEL,
  EXAM_PHASE_BADGE,
  EXAM_PHASE_LABEL,
  examPhase,
  examUrl,
} from '@/lib/examConstants';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import SaveButton from '@/components/saved/SaveButton';

export default function ExamCard({ exam, priority = false }: { exam: Exam; priority?: boolean }) {
  const phase = examPhase(exam);
  const deadline = exam.registration_end ? new Date(exam.registration_end) : null;
  const deadlinePassed =
    // eslint-disable-next-line react-hooks/purity
    deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();

  return (
    <Link href={examUrl(exam)} className="group block w-full text-left" prefetch={priority}>
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm shadow-black/5 transition-all duration-200 hover:border-primary/25 hover:shadow-lg active:scale-[0.99] dark:bg-slate-900">
        <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${EXAM_PHASE_BADGE[phase]}`}
          >
            {EXAM_PHASE_LABEL[phase]}
          </span>
          <span className="inline-flex items-center rounded-full border border-line bg-brand-soft px-2.5 py-0.5 text-[10.5px] font-semibold text-black dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            {EXAM_CATEGORY_LABEL[exam.category] || exam.category}
          </span>
          <span className="ml-auto text-[11px] text-black/50 dark:text-white/50">
            {formatRelativeTime(exam.created_at)}
          </span>
          <SaveButton itemType="exam" itemId={exam.id} variant="icon" />
        </div>

        <h3 className="mb-1 font-bold text-[15px] leading-snug text-black line-clamp-2 transition-colors group-hover:text-primary dark:text-white">
          {exam.title}
        </h3>

        <p className="mb-3 text-[13px] font-semibold text-primary">{exam.organizer}</p>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {exam.diplomas.slice(0, 4).map((d) => (
            <span
              key={d}
              className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[10.5px] font-bold text-black dark:bg-slate-800 dark:text-white"
            >
              {d}
            </span>
          ))}
          {exam.diplomas.length > 4 && (
            <span className="text-[10.5px] font-semibold text-black/50 dark:text-white/50">
              +{exam.diplomas.length - 4}
            </span>
          )}
        </div>

        <p className="mb-4 flex-1 text-[12.5px] leading-relaxed text-black line-clamp-3 dark:text-white">
          {(exam.seo_description || exam.description_md || '')
            .replace(/\*\*/g, '')
            .replace(/#/g, '')
            .slice(0, 200)}
        </p>

        <div className="flex items-center justify-between border-t border-line pt-3 dark:border-slate-800">
          {deadline ? (
            <span
              className={`text-[12px] font-semibold ${
                deadlinePassed ? 'text-rose-500' : 'text-black dark:text-white'
              }`}
            >
              {deadlinePassed
                ? `Clôturé le ${formatDate(exam.registration_end!)}`
                : `Limite : ${formatDate(exam.registration_end!)}`}
            </span>
          ) : (
            <span className="text-[12px] text-black/50 dark:text-white/50">{exam.location || 'Côte d’Ivoire'}</span>
          )}
          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-primary transition-all group-hover:gap-2">
            Voir le concours
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </span>
        </div>
        </div>
      </article>
    </Link>
  );
}

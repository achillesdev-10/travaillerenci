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
import CoverImage from '@/components/content/CoverImage';
import { examDefaultImage } from '@/lib/images';

export default function ExamCard({ exam, priority = false }: { exam: Exam; priority?: boolean }) {
  const phase = examPhase(exam);
  const deadline = exam.registration_end ? new Date(exam.registration_end) : null;
  const deadlinePassed =
    // eslint-disable-next-line react-hooks/purity
    deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();

  return (
    <Link href={examUrl(exam)} className="group block w-full text-left" prefetch={priority}>
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm shadow-black/5 transition-all duration-200 hover:border-primary/25 hover:shadow-lg active:scale-[0.99]">
        {/* Bannière photo par défaut selon la catégorie de concours */}
        <div className="relative h-28 sm:h-32 overflow-hidden bg-gray-100 dark:bg-slate-800">
          <CoverImage
            src={examDefaultImage(exam.category)}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" aria-hidden="true" />
        </div>
        <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10.5px] font-bold ${EXAM_PHASE_BADGE[phase]}`}
          >
            {EXAM_PHASE_LABEL[phase]}
          </span>
          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10.5px] font-semibold text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-gray-300">
            {EXAM_CATEGORY_LABEL[exam.category] || exam.category}
          </span>
          <span className="ml-auto text-[11px] text-gray-400">
            {formatRelativeTime(exam.created_at)}
          </span>
          <SaveButton itemType="exam" itemId={exam.id} variant="icon" />
        </div>

        <h3 className="mb-1 font-bold text-[15px] leading-snug text-gray-900 line-clamp-2 transition-colors group-hover:text-primary dark:text-white">
          {exam.title}
        </h3>

        <p className="mb-3 text-[13px] font-semibold text-primary">{exam.organizer}</p>

        <div className="mb-3 flex flex-wrap gap-1.5">
          {exam.diplomas.slice(0, 4).map((d) => (
            <span
              key={d}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {d}
            </span>
          ))}
          {exam.diplomas.length > 4 && (
            <span className="text-[10.5px] font-semibold text-gray-400">
              +{exam.diplomas.length - 4}
            </span>
          )}
        </div>

        <p className="mb-4 flex-1 text-[12.5px] leading-relaxed text-gray-500 line-clamp-3 dark:text-gray-400">
          {(exam.seo_description || exam.description_md || '')
            .replace(/\*\*/g, '')
            .replace(/#/g, '')
            .slice(0, 200)}
        </p>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3 dark:border-slate-800">
          {deadline ? (
            <span
              className={`text-[12px] font-semibold ${
                deadlinePassed ? 'text-rose-500' : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              {deadlinePassed
                ? `Clôturé le ${formatDate(exam.registration_end!)}`
                : `Limite : ${formatDate(exam.registration_end!)}`}
            </span>
          ) : (
            <span className="text-[12px] text-gray-400">{exam.location || 'Côte d’Ivoire'}</span>
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

import Link from 'next/link';
import Image from 'next/image';
import type { JobOfferSchema } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import SaveButton from '@/components/saved/SaveButton';
import { getJobThumbnail } from '@/lib/jobThumbnails';

function savedType(job: JobOfferSchema): 'job' | 'internship' | 'scholarship' | 'exam' {
  if (job.category === 'internship') return 'internship';
  if (job.category === 'scholarship') return 'scholarship';
  if (job.category === 'exam') return 'exam';
  return 'job';
}

export default function CompactJobCard({ job }: { job: JobOfferSchema }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
      prefetch={false}
    >
      <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm shadow-black/5 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-primary/25 group-hover:shadow-md active:scale-[0.99]">
        {/* Thumbnail with gradient fallback */}
        <div className="relative h-24 sm:h-28 overflow-hidden bg-gradient-to-br from-orange-400 to-amber-500">
          <Image
            src={getJobThumbnail(job)}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            unoptimized={getJobThumbnail(job).startsWith('data:')}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" aria-hidden="true" />
        </div>
        <div className="flex flex-1 flex-col p-3.5 sm:p-4">
          <div className="mb-2 flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold text-accent">
              {job.contract_type}
            </span>
            {job.is_verified && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 12l2 2 4-4" />
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                </svg>
                Vérifié
              </span>
            )}
            <span className="ml-auto text-[10px] font-medium text-gray-400">
              {formatRelativeTime(job.created_at)}
            </span>
            <SaveButton itemType={savedType(job)} itemId={job.id} variant="icon" />
          </div>

          <h3 className="font-bold text-[13px] sm:text-sm leading-snug text-gray-900 line-clamp-2 transition-colors group-hover:text-primary">
            {job.title}
          </h3>

          <p className="mt-1 text-[12px] font-semibold text-primary line-clamp-1">
            {job.company}
          </p>

          <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-gray-500">
              <svg className="h-3 w-3 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{job.location}</span>
            </span>
            <span className="shrink-0 rounded-full bg-gray-50 p-1.5 text-primary transition-all group-hover:bg-primary group-hover:text-white">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

import Link from 'next/link';
import type { JobOfferSchema } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import SaveButton from '@/components/saved/SaveButton';

interface JobCardProps {
  job: JobOfferSchema;
}

/**
 * JobCard — enhanced card for job listings.
 *
 * Information hierarchy:
 *   [ THUMBNAIL ]
 *   [ CONTRACT ] [ VERIFIED ]
 *   Job Title
 *   Company Name
 *   📍 Location
 *   🕐 Relative date
 *   Voir l'offre →
 */
export default function JobCard({ job }: JobCardProps) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-2xl"
    >
      <article className="relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors group-hover:border-primary/30">
        <div className="flex flex-1 flex-col p-4 sm:p-5">
          {/* Badges row */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="inline-flex items-center flex-shrink-0 bg-accent/10 text-accent px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold leading-none">
              {job.contract_type}
            </span>
            {job.is_verified ? (
              <span
                aria-label="Offre vérifiée par TravaillerEnCi"
                className="inline-flex items-center gap-1 flex-shrink-0 bg-primary/10 text-primary px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold leading-none"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 12l2 2 4-4" />
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                </svg>
                Vérifié
              </span>
            ) : null}
            <span className="flex-shrink-0 text-[11px] sm:text-xs text-black dark:text-white font-medium ml-auto">
              {formatRelativeTime(job.created_at)}
            </span>
            <SaveButton
              itemType={job.category === 'internship' ? 'internship' : 'job'}
              itemId={job.id}
              variant="icon"
            />
          </div>

          {/* Title */}
          <h3 className="font-bold text-[15px] sm:text-base leading-snug text-black dark:text-white mb-1 line-clamp-2 group-hover:text-primary transition-colors">
            {job.title}
          </h3>

          {/* Company */}
          <p className="text-sm sm:text-[15px] font-semibold text-primary mb-2">
            {job.company}
          </p>

          {/* Location + meta */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs sm:text-sm text-black dark:text-white mt-auto">
            <span className="inline-flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-black dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="truncate">{job.location}</span>
            </span>
            {job.apply_email && (
              <span className="inline-flex items-center gap-1.5 sm:border-l sm:border-line dark:border-slate-700 sm:pl-4">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-black dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="m3 7 9 6 9-6" />
                </svg>
                Email
              </span>
            )}
            {!job.apply_email && job.apply_link && (
              <span className="inline-flex items-center gap-1.5 sm:border-l sm:border-line dark:border-slate-700 sm:pl-4">
                <svg className="w-3.5 h-3.5 flex-shrink-0 text-black dark:text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
                Lien externe
              </span>
            )}
          </div>

          {/* CTA */}
          <div className="mt-4 pt-3 border-t border-line dark:border-slate-800">
            <span className="text-sm text-primary font-semibold inline-flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
              Voir le poste
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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

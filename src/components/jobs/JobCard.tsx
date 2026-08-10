import Link from 'next/link';
import type { JobOfferSchema } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface JobCardProps {
  job: JobOfferSchema;
  priority?: boolean;
}

export default function JobCard({ job, priority = false }: JobCardProps) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block w-full text-left"
      prefetch={priority}
    >
      <article className="relative bg-white rounded-xl sm:rounded-2xl border border-gray-100 p-4 sm:p-5 shadow-sm shadow-black/5 transition-all duration-200 active:scale-[0.99] hover:shadow-md hover:border-primary/20">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
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
            ) : (
              <span className="inline-flex items-center flex-shrink-0 bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold leading-none">
                En attente de vérification
              </span>
            )}
            <span className="inline-flex items-center flex-shrink-0 bg-accent/10 text-accent px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-bold leading-none">
              {job.contract_type}
            </span>
          </div>
          {/* « il y a Xh » = durée depuis la 1ᵉʳ intégration de l'offre sur
              TravaillerEnCi (created_at, UTC — posée à l'insertion, jamais
              réécrite par les rafraîchissements du scraper). Ce n'est PAS la
              date de publication sur le site source : une offre « il y a 15h »
              juste après un scraping frais est une offre ajoutée au cycle
              précédent et simplement mise à jour — comportement voulu. */}
          <span className="flex-shrink-0 text-[11px] sm:text-xs text-gray-400 font-medium">
            {formatRelativeTime(job.created_at)}
          </span>
        </div>

        <h3 className="font-bold text-[15px] sm:text-base leading-snug text-gray-900 mb-1 line-clamp-2 group-hover:text-primary transition-colors">
          {job.title}
        </h3>

        <p className="text-sm sm:text-[15px] font-semibold text-primary mb-3">
          {job.company}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-3">
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="truncate">{job.location}</span>
          </span>
          {job.apply_email && (
            <span className="inline-flex items-center gap-1.5 sm:border-l sm:border-gray-200 sm:pl-4">
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
              Candidature par email
            </span>
          )}
          {!job.apply_email && job.apply_link && (
            <span className="inline-flex items-center gap-1.5 sm:border-l sm:border-gray-200 sm:pl-4">
              <svg className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              Lien externe
            </span>
          )}
        </div>

        <p className="text-xs sm:text-sm text-gray-600 line-clamp-2 leading-relaxed">
          {job.description
            .replace(/\*\*/g, '')
            .replace(/\n/g, ' ')
            .slice(0, 140)
            .trim()}…
        </p>

        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-primary font-semibold inline-flex items-center gap-1.5 group-hover:gap-2 transition-all">
            Voir le poste
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </div>
      </article>
    </Link>
  );
}

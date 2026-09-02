/**
 * Skeleton loading components for job cards and lists.
 * Matches final layout dimensions to prevent CLS.
 * Respects prefers-reduced-motion via the animate-pulse class behavior.
 */

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gray-200 dark:bg-slate-700 ${className}`}
      aria-hidden="true"
    />
  );
}

/**
 * Skeleton matching the CompactJobCard layout (used in grids).
 */
export function CompactJobCardSkeleton() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" aria-busy="true" aria-label="Chargement de l'offre…">
      <SkeletonBlock className="h-24 sm:h-28 rounded-none" />
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <SkeletonBlock className="h-5 w-12 rounded-full" />
          <SkeletonBlock className="h-5 w-14 rounded-full" />
        </div>
        <SkeletonBlock className="h-4 w-full rounded mb-2" />
        <SkeletonBlock className="h-4 w-3/4 rounded mb-1" />
        <SkeletonBlock className="h-3 w-1/2 rounded mt-auto" />
        <div className="flex items-center justify-between gap-2 pt-2.5">
          <SkeletonBlock className="h-3 w-24 rounded" />
          <SkeletonBlock className="h-6 w-6 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton matching the full JobCard layout.
 */
export function JobCardSkeleton() {
  return (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm" aria-busy="true" aria-label="Chargement de l'offre…">
      <SkeletonBlock className="h-28 sm:h-36 rounded-none" />
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <SkeletonBlock className="h-5 w-12 rounded-full" />
          <SkeletonBlock className="h-5 w-14 rounded-full" />
          <SkeletonBlock className="h-4 w-16 rounded ml-auto" />
        </div>
        <SkeletonBlock className="h-5 w-full rounded mb-2" />
        <SkeletonBlock className="h-5 w-2/3 rounded mb-2" />
        <SkeletonBlock className="h-4 w-1/2 rounded mb-2" />
        <div className="mt-auto">
          <SkeletonBlock className="h-3 w-32 rounded" />
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <SkeletonBlock className="h-4 w-24 rounded" />
        </div>
      </div>
    </div>
  );
}

/**
 * Grid of compact skeletons matching the offers grid layout.
 */
export function JobListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div
      className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5"
      role="status"
      aria-label="Chargement des offres…"
    >
      {Array.from({ length: count }, (_, i) => (
        <CompactJobCardSkeleton key={i} />
      ))}
      <span className="sr-only">Chargement des offres…</span>
    </div>
  );
}

import Link from 'next/link';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import type { JobOfferSchema } from '@/types';
import { formatDate, truncate } from '@/lib/utils';
import { getSiteUrl } from '@/lib/site';
import SaveButton from '@/components/saved/SaveButton';
import CoverImage from '@/components/content/CoverImage';
import { jobDefaultImage } from '@/lib/images';

export const metadata = {
  title: "Bourses d'études en Côte d'Ivoire",
  description:
    "Découvrez les bourses d'études disponibles en Côte d'Ivoire et à l'international pour financer votre parcours académique. Programme de bourses, aides financières, universités partenaires.",
  alternates: {
    canonical: `${getSiteUrl()}/bourses`,
  },
  openGraph: {
    type: 'website',
    locale: 'fr_CI',
    url: `${getSiteUrl()}/bourses`,
    siteName: 'TravaillerenCi',
    title: "Bourses d'études en Côte d'Ivoire | TravaillerenCi",
    description:
      "Découvrez les bourses d'études en Côte d'Ivoire et à l'international : programme de bourses, aides financières et universités partenaires.",
  },
  twitter: {
    card: 'summary_large_image',
    title: "Bourses d'études en Côte d'Ivoire | TravaillerenCi",
    description:
      "Bourses d'études en Côte d'Ivoire et à l'international : programme de bourses, aides financières et universités partenaires.",
  },
};

export const dynamic = 'force-dynamic';

export default async function BoursesPage() {
  const { rows: bourses, total } = await JobOfferSchemaService.list({
    category: 'scholarship',
    status: 'published',
    // Les bourses dont la date limite est dépassée ne doivent plus être
    // présentées comme des opportunités actives.
    is_expired: false,
    limit: 100,
    order_by: 'created_at',
    order_dir: 'desc',
  });

  return (
    <main className="flex-1 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors py-8 sm:py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        <nav aria-label="Fil d'Ariane" className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          <Link href="/" className="hover:text-primary">
            Accueil
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-gray-900 dark:text-gray-200 font-medium">
            Bourses d'études
          </span>
        </nav>

        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-extrabold mb-3 font-[var(--font-display)] text-gray-900 dark:text-white">
            Bourses d'études en Côte d'Ivoire
          </h1>
          <p className="text-gray-600 dark:text-gray-300 text-base sm:text-lg max-w-2xl">
            Trouvez la bourse idéale pour financer vos études supérieures en
            Côte d'Ivoire ou à l'étranger — universités partenaires, bourses
            gouvernementales et programmes de financement vérifiés.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)]">
            {total} bourse{total > 1 ? 's' : ''} disponible{total > 1 ? 's' : ''}
          </h2>
        </div>

        {bourses.length > 0 ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {bourses.map((bourse) => (
              <ScholarshipCard key={bourse.id} bourse={bourse as JobOfferSchema} />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-border rounded-2xl p-8 sm:p-12 text-center">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gray-50 dark:bg-slate-800 flex items-center justify-center mb-5">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              </svg>
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-2 font-[var(--font-display)]">
              Aucune bourse publiée pour le moment
            </h3>
            <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Le scraper collecte en continu les bourses d'études publiques et
              privées. Les nouvelles opportunités apparaîtront ici dès leur
              validation par notre équipe de modération.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-sm shadow-md transition-all"
            >
              Retour à l'accueil
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

function ScholarshipCard({ bourse }: { bourse: JobOfferSchema }) {
  const deadline = bourse.deadline ? new Date(bourse.deadline) : null;
  const deadlinePassed = // eslint-disable-next-line react-hooks/purity
    deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();

  return (
    <Link
      href={`/bourses/${bourse.id}`}
      className="group bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-primary/30 hover:shadow-lg transition-all flex flex-col"
    >
      {/* Bannière photo par défaut (bourse = catégorie scholarship) */}
      <div className="relative h-24 sm:h-28 overflow-hidden bg-gray-100 dark:bg-slate-800">
        <CoverImage
          src={jobDefaultImage('scholarship')}
          alt=""
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" aria-hidden="true" />
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[10.5px] font-bold text-amber-600 dark:text-amber-400">
          Bourse
        </span>
        {deadline && (
          <span
            className={`text-[11px] font-semibold ${
              deadlinePassed ? 'text-rose-500' : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {deadlinePassed ? 'Clôturée le ' : 'Limite : '}
            {formatDate(bourse.deadline!)}
          </span>
        )}
        <SaveButton itemType="scholarship" itemId={bourse.id} variant="icon" />
      </div>

      <h3 className="font-bold text-[15px] leading-snug text-gray-900 dark:text-white line-clamp-2 mb-1 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
        {bourse.title}
      </h3>

      <div className="text-[13px] text-primary dark:text-emerald-400 font-semibold mb-2 truncate">
        {bourse.company}
      </div>

      <p className="text-[12.5px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-3 mb-4 flex-1">
        {truncate(
          (bourse.seo_description || bourse.description || '').replace(/\*\*/g, '').replace(/#/g, ''),
          160,
        )}
      </p>

      <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-3 mt-auto">
        <div className="text-[12px] text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {bourse.location || 'International'}
        </div>
        <span className="inline-flex items-center gap-1 text-[12px] font-bold text-primary dark:text-emerald-400 group-hover:gap-2 transition-all">
          Voir la bourse
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
      </div>
    </Link>
  );
}

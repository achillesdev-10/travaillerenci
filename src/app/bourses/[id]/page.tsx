import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';
import SafetyNotice from '@/components/content/SafetyNotice';
import SaveButton from '@/components/saved/SaveButton';
import type { JobOfferSchema } from '@/types';
import { formatDate, truncate } from '@/lib/utils';
import { getSiteUrl } from '@/lib/site';
import { jobDefaultImage } from '@/lib/images';
import CoverImage from '@/components/content/CoverImage';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const bourse = await JobOfferSchemaService.getById(id);
  if (!bourse || bourse.category !== 'scholarship') {
    return { title: 'Bourse introuvable', robots: { index: false, follow: false } };
  }
  const desc = truncate(
    (bourse.seo_description || bourse.description || '').replace(/\*\*/g, '').replace(/#/g, ' '),
    170,
  );
  const canonicalUrl = `${getSiteUrl()}/bourses/${bourse.id}`;
  const ogImage = jobDefaultImage('scholarship');
  return {
    title: bourse.seo_title || `${bourse.title} | TravaillerEnCi`,
    description: desc,
    keywords: bourse.seo_keywords || undefined,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'article',
      title: bourse.title,
      description: desc,
      locale: 'fr_CI',
      url: canonicalUrl,
      siteName: 'TravaillerenCi',
      images: [{ url: ogImage, width: 1200, height: 800, alt: bourse.title }],
      tags: ['bourse', "bourse d'études", bourse.location || 'International'],
    },
    twitter: {
      card: 'summary_large_image',
      title: bourse.title,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function BourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  const bourse = await JobOfferSchemaService.getById(id);

  if (!bourse || bourse.category !== 'scholarship') {
    notFound();
  }

  const deadline = bourse.deadline ? new Date(bourse.deadline) : null;
  const deadlinePassed =
    // eslint-disable-next-line react-hooks/purity
    deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();

  const hasLink = Boolean(bourse.apply_link);
  const hasEmail = Boolean(bourse.apply_email);

  // Bourses similaires : même pays/lieu d'abord, puis les plus récentes.
  const [byLocation, latest] = await Promise.all([
    JobOfferSchemaService.list({
      category: 'scholarship',
      status: 'published',
      location: bourse.location ? bourse.location.split(',')[0].split(' - ')[0] : undefined,
      limit: 4,
    }),
    JobOfferSchemaService.list({
      category: 'scholarship',
      status: 'published',
      limit: 4,
      order_by: 'created_at',
      order_dir: 'desc',
    }),
  ]);
  const seen = new Set<string>([bourse.id]);
  const related = [...byLocation.rows, ...latest.rows]
    .filter((b) => {
      if (seen.has(b.id)) return false;
      seen.add(b.id);
      return true;
    })
    .slice(0, 3);

  const canonicalUrl = `${getSiteUrl()}/bourses/${bourse.id}`;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${getSiteUrl()}/` },
      { '@type': 'ListItem', position: 2, name: "Bourses d'études", item: `${getSiteUrl()}/bourses` },
      { '@type': 'ListItem', position: 3, name: bourse.title, item: canonicalUrl },
    ],
  };

  return (
    <main className="flex-1 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <section className="bg-amber-500/5 dark:bg-amber-500/10 border-b border-gray-100 dark:border-slate-800">
        <div className="container mx-auto px-4 pt-4 sm:pt-8 pb-6 max-w-4xl">
          {/* Bannière photo par défaut (bourse = catégorie scholarship) */}
          <div className="relative h-40 sm:h-56 overflow-hidden rounded-2xl sm:rounded-3xl shadow-lg mb-5 sm:mb-6">
            <CoverImage
              src={jobDefaultImage('scholarship')}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" aria-hidden="true" />
          </div>

          <nav aria-label="Fil d'Ariane" className="mb-4 sm:mb-6">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] sm:text-sm text-gray-500 dark:text-gray-400">
              <li>
                <Link href="/" className="hover:text-primary hover:underline">
                  Accueil
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/bourses" className="hover:text-primary hover:underline">
                  Bourses
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[60vw]">
                {bourse.title}
              </li>
            </ol>
          </nav>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs sm:text-sm font-bold text-amber-600 dark:text-amber-400">
              Bourse d'études
            </span>
            {deadline && (
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs sm:text-sm font-semibold ${
                  deadlinePassed
                    ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30'
                    : 'bg-primary/10 text-primary dark:text-emerald-400 border border-primary/20'
                }`}
              >
                {deadlinePassed ? `Clôturée le ${formatDate(bourse.deadline!)}` : `Limite : ${formatDate(bourse.deadline!)}`}
              </span>
            )}
          </div>

          <h1 className="text-[26px] sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-3 font-[var(--font-display)]">
            {bourse.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] sm:text-base">
            <div className="text-primary dark:text-emerald-400 font-bold">{bourse.company}</div>
            <div className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {bourse.location || 'International'}
            </div>
            <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500">
              Publiée le {formatDate(bourse.created_at)}
            </span>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-6 sm:py-10 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          <article className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm shadow-black/5 p-5 sm:p-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 font-[var(--font-display)]">
                À propos de cette bourse
              </h2>
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
                <SimpleMarkdown text={bourse.description} />
              </div>
            </div>

            {/* Mention anti-arnaque — candidater à une bourse est gratuit */}
            <SafetyNotice
              variant="scholarship"
              itemType="scholarship"
              itemId={bourse.id}
              itemLabel={bourse.title}
              className="mt-6"
            />

            {/* Bourses similaires — maillage interne */}
            {related.length > 0 && (
              <div className="mt-8 sm:mt-10">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-5 font-[var(--font-display)]">
                  Autres bourses à découvrir
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 list-none m-0 p-0">
                  {related.map((b) => (
                    <li key={b.id}>
                      <MiniBourseCard bourse={b as JobOfferSchema} />
                    </li>
                  ))}
                </ul>
                <div className="mt-4">
                  <Link
                    href="/bourses"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    Voir toutes les bourses d'études
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}

            {/* Maillage interne — catégories principales */}
            <nav aria-label="Liens complémentaires" className="mt-8 sm:mt-10">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 font-[var(--font-display)]">
                Explorer davantage
              </h2>
              <ul className="flex flex-wrap gap-2.5 list-none m-0 p-0">
                <li>
                  <Link
                    href="/jobs"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Offres d'emploi
                  </Link>
                </li>
                <li>
                  <Link
                    href="/stages"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Stages
                  </Link>
                </li>
                <li>
                  <Link
                    href="/concours"
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300"
                  >
                    Concours administratifs
                  </Link>
                </li>
              </ul>
            </nav>
          </article>

          <aside className="lg:col-span-1 space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 14l9-5-9-5-9 5 9 5z" />
                    <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                  </svg>
                </div>
                <div>
                  <div className="font-bold text-gray-900 dark:text-white">Candidater</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Via l'organisme de la bourse</div>
                </div>
              </div>
              <div className="space-y-2.5">
                {hasLink ? (
                  <a
                    href={bourse.apply_link!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-lg shadow-primary/25 transition-all"
                  >
                    Postuler à cette bourse
                  </a>
                ) : null}
                {hasEmail ? (
                  <a
                    href={`mailto:${bourse.apply_email}?subject=${encodeURIComponent(`Candidature bourse : ${bourse.title}`)}`}
                    className="flex w-full items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold text-sm transition-all"
                  >
                    Postuler par email
                  </a>
                ) : null}
                {!hasLink && !hasEmail ? (
                  <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                    Contactez l'organisme via la page d'origine ci-dessous.
                  </p>
                ) : null}
              </div>
              <div className="mt-3">
                <SaveButton
                  itemType="scholarship"
                  itemId={bourse.id}
                  label="Sauvegarder cette bourse"
                  className="w-full"
                />
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 text-sm">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">
                Informations utiles
              </h3>
              <dl className="space-y-3.5">
                <MetaRow label="Bailleur" value={bourse.company} />
                <MetaRow label="Pays / Lieu" value={bourse.location || 'International'} />
                {deadline ? (
                  <MetaRow
                    label="Date limite"
                    value={formatDate(bourse.deadline!)}
                    tone={deadlinePassed ? 'danger' : 'normal'}
                  />
                ) : null}
                <MetaRow label="Publiée le" value={formatDate(bourse.created_at)} />
                {bourse.source_url ? (
                  <MetaRow label="Source" value="Voir l'annonce originale" href={bourse.source_url} external />
                ) : null}
              </dl>
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function MetaRow({
  label,
  value,
  href,
  external,
  tone = 'normal',
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
  tone?: 'normal' | 'danger';
}) {
  const ValueComp = href ? (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="font-medium text-primary dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
    >
      {value}
      {external && (
        <svg className="w-3.5 h-3.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7" />
          <path d="M7 7h10v10" />
        </svg>
      )}
    </a>
  ) : (
    <span
      className={`font-medium ${
        tone === 'danger'
          ? 'text-rose-500'
          : 'text-gray-800 dark:text-gray-200'
      }`}
    >
      {value}
    </span>
  );
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <dd className="text-right break-words">{ValueComp}</dd>
    </div>
  );
}

function MiniBourseCard({ bourse }: { bourse: JobOfferSchema }) {
  const deadline = bourse.deadline ? new Date(bourse.deadline) : null;
  const deadlinePassed =
    // eslint-disable-next-line react-hooks/purity
    deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() < Date.now();

  return (
    <Link
      href={`/bourses/${bourse.id}`}
      className="group block bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-primary/25 hover:shadow-md p-4 transition-all"
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className="inline-flex items-center bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10.5px] font-bold">
          Bourse
        </span>
        {deadline && (
          <span
            className={`text-[11px] font-semibold ${deadlinePassed ? 'text-rose-500' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {deadlinePassed ? 'Clôturée le ' : 'Limite : '}
            {formatDate(bourse.deadline!)}
          </span>
        )}
      </div>
      <h3 className="font-bold text-[14px] leading-snug text-gray-900 dark:text-white line-clamp-2 mb-1 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
        {bourse.title}
      </h3>
      <div className="text-[13px] text-primary dark:text-emerald-400 font-semibold mb-0.5 truncate">
        {bourse.company}
      </div>
      <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
        {bourse.location || 'International'}
      </div>
    </Link>
  );
}

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Metadata } from 'next';
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
  const job = await JobOfferSchemaService.getById(id);
  if (!job) {
    return {
      title: 'Offre introuvable',
      robots: { index: false, follow: false },
    };
  }
  const desc = truncate(
    (job.seo_description || job.description).replace(/\*\*/g, '').replace(/\n/g, ' '),
    170
  );
  const canonicalUrl = `${getSiteUrl()}/jobs/${job.slug || job.id}`;
  return {
    title: job.seo_title || `${job.title} — ${job.company} | TravaillerEnCi`,
    description: desc,
    keywords: job.seo_keywords || undefined,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      type: 'article',
      url: canonicalUrl,
      siteName: 'TravaillerEnCi',
      title: `${job.title} chez ${job.company}`,
      description: desc,
      locale: 'fr_CI',
      tags: [job.contract_type, job.company, job.location],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${job.title} chez ${job.company}`,
      description: desc,
    },
  };
}

export default async function JobDetailPage({ params }: PageProps) {
  const { id } = await params;
  const job = await JobOfferSchemaService.getById(id);

  if (!job) {
    notFound();
  }

  // Suggestions : 3 offres de la même localisation ou du même type de contrat
  const [similarByType, similarByLocation] = await Promise.all([
    JobOfferSchemaService.list({ category: ['job', 'internship'], contract_type: job.contract_type, limit: 4 }),
    JobOfferSchemaService.list({ category: ['job', 'internship'], location: job.location.split(',')[0].split(' - ')[0], limit: 4 }),
  ]);

  const similarIds = new Set<string>([job.id]);
  const similar = [...similarByType.rows, ...similarByLocation.rows].filter((s) => {
    if (similarIds.has(s.id)) return false;
    similarIds.add(s.id);
    return true;
  }).slice(0, 3);

  const jobPostingJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    identifier: {
      '@type': 'PropertyValue',
      name: job.company,
      value: job.id,
    },
    datePosted: job.created_at,
    validThrough: new Date(new Date(job.created_at).getTime() + 90 * 86400000).toISOString(),
    employmentType: job.contract_type === 'CDI' ? 'FULL_TIME' : job.contract_type === 'CDD' ? 'FULL_TIME' : job.contract_type === 'Stage' ? 'INTERN' : 'OTHER',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      sameAs: job.source_url || getSiteUrl(),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        streetAddress: job.location,
        addressLocality: job.location,
        addressRegion: 'Abidjan',
        addressCountry: 'CI',
      },
    },
    applicantLocationRequirements: {
      '@type': 'Country',
      name: 'Côte d\'Ivoire',
    },
  };

  return (
    <main className="flex-1 min-h-screen bg-gray-50 dark:bg-slate-950 transition-colors">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd) }}
      />
      {/* ============= HERO / HEADER DU POSTE ============= */}
      <section className="bg-primary/5 dark:bg-primary/10 border-b border-gray-100 dark:border-slate-800">
        <div className="container mx-auto px-4 pt-4 sm:pt-8 pb-6 max-w-4xl">
          {/* Bannière photo par défaut selon la catégorie */}
          <div className="relative h-40 sm:h-56 overflow-hidden rounded-2xl sm:rounded-3xl shadow-lg mb-5 sm:mb-6">
            <CoverImage
              src={jobDefaultImage(job.category)}
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
                <Link href="/jobs" className="hover:text-primary hover:underline">
                  Offres
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="text-gray-700 dark:text-gray-200 font-medium truncate max-w-[60vw]">
                {job.title}
              </li>
            </ol>
          </nav>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {job.is_verified ? (
                  <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary dark:text-emerald-400 px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 12l2 2 4-4" />
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                    </svg>
                    Offre vérifiée TravaillerEnCi
                  </span>
                ) : (
                  <span className="inline-flex items-center bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400 px-3 py-1 rounded-full text-xs sm:text-sm font-semibold">
                    Non vérifiée
                  </span>
                )}
                <span className="inline-flex items-center bg-accent/10 text-accent dark:text-blue-400 px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                  {job.contract_type}
                </span>
                <span className="text-[11px] sm:text-xs text-gray-400 dark:text-gray-500 ml-auto sm:ml-0">
                  Publiée le {formatDate(job.created_at)}
                </span>
              </div>

              <h1 className="text-[26px] sm:text-3xl lg:text-4xl font-extrabold text-gray-900 dark:text-white leading-tight mb-2 font-[var(--font-display)]">
                {job.title}
              </h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-4 sm:mb-5 text-[14px] sm:text-base">
                <div className="text-primary dark:text-emerald-400 font-bold">{job.company}</div>
                <div className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {job.location}
                </div>
              </div>

              {/* Actions : Partager sur WhatsApp + Sauvegarder */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`*${job.title}* chez *${job.company}* (${job.location})\n\nConsultez l'offre complète sur TravaillerEnCi : ${getSiteUrl()}/jobs/${job.id}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-emerald-600/20 transition-all"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                  </svg>
                  Partager sur WhatsApp
                </a>
                <SaveButton
                  itemType={job.category === 'internship' ? 'internship' : 'job'}
                  itemId={job.id}
                  label="Sauvegarder"
                />
              </div>
            </div>
          </div>

          <div className="hidden sm:block mt-6">
            <ApplyBox job={job} variant="horizontal" />
          </div>
        </div>
      </section>

      {/* ============= CONTENU PRINCIPAL ============= */}
      <section className="container mx-auto px-4 py-6 sm:py-10 max-w-4xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Colonne gauche — description */}
          <article className="lg:col-span-2 order-2 lg:order-1">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm shadow-black/5 p-5 sm:p-8">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 font-[var(--font-display)]">
                À propos de ce poste
              </h2>
              <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
                <SimpleMarkdown text={job.description} />
              </div>
            </div>

            {/* Mention anti-arnaque — postuler est gratuit */}
            <SafetyNotice
              variant="job"
              itemType={job.category === 'internship' ? 'internship' : 'job'}
              itemId={job.id}
              itemLabel={`${job.title} — ${job.company}`}
              className="mt-6"
            />

            {/* Offres similaires */}
            {similar.length > 0 && (
              <div className="mt-8 sm:mt-10">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-5 font-[var(--font-display)]">
                  Offres similaires qui pourraient vous intéresser
                </h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 list-none m-0 p-0">
                  {similar.map((s) => (
                    <li key={s.id}>
                      <MiniJobCard job={s as JobOfferSchema} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>

          {/* Colonne droite — CTA desktop + méta */}
          <aside className="lg:col-span-1 order-1 lg:order-2 space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="sm:hidden">
              <ApplyBox job={job} variant="vertical" />
            </div>
            <div className="hidden lg:block">
              <ApplyBox job={job} variant="vertical" />
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm p-5 text-sm">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Informations utiles</h3>
              <dl className="space-y-3.5">
                <MetaRow label="Entreprise" value={job.company} />
                <MetaRow label="Ville" value={job.location} />
                <MetaRow label="Contrat" value={job.contract_type} />
                <MetaRow
                  label="Vérifié"
                  value={job.is_verified ? 'Oui — par TravaillerEnCi' : 'En cours'}
                />
                <MetaRow label="Publiée le" value={formatDate(job.created_at)} />
                {job.source_url && (
                  <MetaRow
                    label="Source"
                    value="Voir l'annonce originale"
                    href={job.source_url}
                    external
                  />
                )}
              </dl>
            </div>
          </aside>
        </div>
      </section>

      {/* ============= STICKY CTA MOBILE BAS DE PAGE ============= */}
      <div className="lg:hidden sticky bottom-0 inset-x-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-gray-200 dark:border-slate-800 px-3 py-3 safe-bottom">
        <ApplyBox job={job} variant="compact" />
      </div>
    </main>
  );
}

// =============================================================================
//  SOUS-COMPOSANTS
// =============================================================================

function ApplyBox({
  job,
  variant,
}: {
  job: JobOfferSchema;
  variant: 'horizontal' | 'vertical' | 'compact';
}) {
  const hasLink = Boolean(job.apply_link);
  const hasEmail = Boolean(job.apply_email);

  if (variant === 'compact') {
    return (
      <div className="flex items-stretch gap-2">
        {hasEmail ? (
          <a
            href={`mailto:${job.apply_email}?subject=${encodeURIComponent(`Candidature : ${job.title} (TravaillerEnCi)`)}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md shadow-primary/25 active:scale-[0.99] transition-all"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </svg>
            Email
          </a>
        ) : null}
        {hasLink ? (
          <a
            href={job.apply_link!}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md shadow-primary/25 active:scale-[0.99] transition-all"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Postuler
          </a>
        ) : null}
      </div>
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 bg-white/90 dark:bg-slate-900/90 backdrop-blur rounded-2xl border border-gray-100 dark:border-slate-800 p-3 sm:p-4 shadow-sm">
        <div className="text-[13px] sm:text-sm text-gray-500 dark:text-gray-400 flex-1">
          Prêt à postuler ? Choisissez votre méthode :
        </div>
        <ApplyActions job={job} />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm shadow-black/5 p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary dark:text-emerald-400 flex items-center justify-center">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
            <path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5l5 5v9a2 2 0 0 1-2 2h-1" />
            <path d="M9 18H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h10a2 2 0 0 0 2-2 2 2 0 0 0-2-2" />
          </svg>
        </div>
        <div>
          <div className="font-bold text-gray-900 dark:text-white">Postuler maintenant</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">1 à 2 minutes</div>
        </div>
      </div>
      <ApplyActions job={job} />
      <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
        En postulant, vous acceptez que vos informations soient transmises à {job.company}.
        TravaillerEnCi n'est pas l'employeur et ne participe pas au processus de recrutement.
      </p>
    </div>
  );
}

function ApplyActions({ job }: { job: JobOfferSchema }) {
  const hasLink = Boolean(job.apply_link);
  const hasEmail = Boolean(job.apply_email);

  return (
    <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full sm:w-auto sm:shrink-0">
      {hasLink ? (
        <a
          href={job.apply_link!}
          target="_blank"
          rel="noopener noreferrer"
          className="group inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm sm:text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.99] transition-all w-full sm:w-auto"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
          Postuler à l'offre
          <svg className="w-4 h-4 shrink-0 opacity-80 group-hover:translate-x-0.5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17L17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </a>
      ) : hasEmail ? (
        <a
          href={`mailto:${job.apply_email}?subject=${encodeURIComponent(`Candidature : ${job.title} (TravaillerEnCi)`)}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm sm:text-base shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.99] transition-all w-full sm:w-auto"
        >
          <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          Postuler par email
        </a>
      ) : null}

      {hasLink && hasEmail ? (
        <a
          href={`mailto:${job.apply_email}?subject=${encodeURIComponent(`Candidature : ${job.title} (TravaillerEnCi)`)}`}
          className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200 font-semibold text-sm sm:text-base transition-all w-full sm:w-auto"
        >
          <svg className="w-4.5 h-4.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="m3 7 9 6 9-6" />
          </svg>
          Postuler par email
        </a>
      ) : null}
    </div>
  );
}

function MetaRow({
  label,
  value,
  href,
  external,
}: {
  label: string;
  value: string;
  href?: string;
  external?: boolean;
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
    <span className="font-medium text-gray-800 dark:text-gray-200">{value}</span>
  );
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-gray-500 dark:text-gray-400 shrink-0">{label}</dt>
      <dd className="text-right break-words">{ValueComp}</dd>
    </div>
  );
}

function MiniJobCard({ job }: { job: JobOfferSchema }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 hover:border-primary/25 hover:shadow-md p-4 transition-all"
    >
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
          job.is_verified
            ? 'bg-primary/10 text-primary dark:text-emerald-400'
            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-gray-400'
        }`}>
          {job.is_verified ? '✓ Vérifié' : job.contract_type}
        </span>
        {job.is_verified ? (
          <span className="inline-flex items-center bg-accent/10 text-accent dark:text-blue-400 px-2 py-0.5 rounded-full text-[10.5px] font-bold">
            {job.contract_type}
          </span>
        ) : null}
      </div>
      <h3 className="font-bold text-[14px] leading-snug text-gray-900 dark:text-white line-clamp-2 mb-1 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
        {job.title}
      </h3>
      <div className="text-[13px] text-primary dark:text-emerald-400 font-semibold mb-0.5 truncate">
        {job.company}
      </div>
      <div className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{job.location}</div>
    </Link>
  );
}


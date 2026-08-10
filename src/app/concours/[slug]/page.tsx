import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ExamService } from '@/services/examService';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';
import SafetyNotice from '@/components/content/SafetyNotice';
import SaveButton from '@/components/saved/SaveButton';
import ExamViewsTracker from '@/components/exams/ExamViewsTracker';
import {
  EXAM_CATEGORY_LABEL,
  EXAM_CONFIDENCE_LABEL,
  EXAM_PHASE_BADGE,
  EXAM_PHASE_LABEL,
  EXAM_TYPE_LABEL,
  examPhase,
  examUrl,
} from '@/lib/examConstants';
import { CATEGORY_SEO } from '@/lib/examSeo';
import { cn, formatDate, truncate } from '@/lib/utils';
import { getSiteUrl } from '@/lib/site';
import { examDefaultImage } from '@/lib/images';
import CoverImage from '@/components/content/CoverImage';
import type { Exam } from '@/types/exam';

export const revalidate = 300;

interface PageProps {
  params: Promise<{ slug: string }>;
}

const BASE_URL = getSiteUrl();

// Mots-clés emploi par catégorie de concours — pour le bloc « Offres liées »
// (connexion concours ↔ emploi, uniquement quand les résultats sont publiés).
const CATEGORY_JOB_KEYWORDS: Record<string, string[]> = {
  administratif: ['fonction publique', 'agent administratif', 'secrétaire'],
  sante: ['infirmier', 'sage-femme', 'santé', 'laborantin'],
  enseignement: ['enseignant', 'instituteur', 'professeur', 'formateur'],
  securite: ['gardien', 'sécurité', 'agent de sécurité'],
  militaire: ['militaire', 'gendarmerie', 'armée'],
  autre: [],
};

/**
 * Résolution de la fiche : le slug SEO d'abord, puis repli sur l'ID (URLs
 * legacy indexées avant la migration vers les slugs) pour rediriger en 301.
 */
async function findExam(param: string): Promise<Exam | null> {
  return (await ExamService.getBySlug(param)) || (await ExamService.getById(param));
}

/**
 * Meta description avec les infos clés (spec §2.1) : diplôme(s), statut,
 * dates — construite si le champ seo_description du pipeline est absent.
 */
function buildMetaDescription(exam: Exam): string {
  if (exam.seo_description) {
    return truncate(exam.seo_description.replace(/\*\*/g, '').replace(/#/g, ' '), 170);
  }
  const facts: string[] = [];
  if (exam.diplomas.length > 0) {
    facts.push(`Diplôme(s) : ${exam.diplomas.slice(0, 3).join(', ')}`);
  }
  if (exam.registration_end) {
    facts.push(`Inscriptions jusqu'au ${formatDate(exam.registration_end)}`);
  }
  if (exam.exam_date) facts.push(`Épreuves le ${formatDate(exam.exam_date)}`);
  facts.push(`Statut : ${EXAM_PHASE_LABEL[examPhase(exam)]}`);
  return truncate(`Concours ${exam.title} — ${exam.organizer}. ${facts.join('. ')}.`, 170);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const exam = await findExam(slug);
  if (!exam || exam.status !== 'published') {
    return { title: 'Concours introuvable', robots: { index: false, follow: false } };
  }
  const desc = buildMetaDescription(exam);
  const path = examUrl(exam);
  const url = `${BASE_URL}${path}`;
  const ogImage = `${BASE_URL}/api/og/exam/${exam.id}`;
  return {
    title: exam.seo_title || `${exam.title} | TravaillerenCi`,
    description: desc,
    keywords: exam.seo_keywords || undefined,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      title: exam.title,
      description: desc,
      locale: 'fr_CI',
      url,
      siteName: 'TravaillerenCi',
      images: [{ url: ogImage, width: 1200, height: 630, alt: exam.title }],
      tags: ['concours', exam.organizer, exam.category, ...(exam.diplomas || [])],
    },
    twitter: {
      card: 'summary_large_image',
      title: exam.title,
      description: desc,
      images: [ogImage],
    },
  };
}

export default async function ConcoursDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const exam = await findExam(slug);

  if (!exam || exam.status !== 'published') {
    notFound();
  }

  // URLs legacy (par ID) → redirection permanente vers le slug descriptif (SEO).
  if (exam.slug && exam.slug !== slug) {
    permanentRedirect(`/concours/${exam.slug}`);
  }

  const phase = examPhase(exam);
  const now = Date.now();
  const regEnd = exam.registration_end ? new Date(exam.registration_end).getTime() : null;
  const regStart = exam.registration_start ? new Date(exam.registration_start).getTime() : null;
  const examDate = exam.exam_date ? new Date(exam.exam_date).getTime() : null;
  const resultsDate = exam.results_date ? new Date(exam.results_date).getTime() : null;
  const isOpen = regEnd !== null && regEnd > now;

  const path = examUrl(exam);
  const absoluteUrl = `${BASE_URL}${path}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationEvent',
        name: exam.title,
        description: (exam.seo_description || exam.description_md || '').replace(/\*\*/g, ''),
        organizer: { '@type': 'Organization', name: exam.organizer },
        location: exam.location
          ? { '@type': 'Place', name: exam.location, address: { addressCountry: 'CI' } }
          : { '@type': 'Place', address: { addressCountry: 'CI' } },
        eventStatus: 'https://schema.org/EventScheduled',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        ...(regStart ? { startDate: new Date(regStart).toISOString() } : {}),
        ...(regEnd ? { endDate: new Date(regEnd).toISOString() } : {}),
        ...(exam.exam_date
          ? {
              additionalProperty: {
                '@type': 'PropertyValue',
                name: 'Date des épreuves',
                value: new Date(examDate!).toISOString(),
              },
            }
          : {}),
        offers: exam.registration_fee
          ? {
              '@type': 'Offer',
              price: exam.registration_fee.replace(/[^\d]/g, ''),
              priceCurrency: 'XOF',
              url: absoluteUrl,
            }
          : undefined,
        url: absoluteUrl,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE_URL },
          { '@type': 'ListItem', position: 2, name: 'Concours', item: `${BASE_URL}/concours` },
          {
            '@type': 'ListItem',
            position: 3,
            name: EXAM_CATEGORY_LABEL[exam.category] || 'Concours',
            item: `${BASE_URL}/concours/categorie/${exam.category}`,
          },
          { '@type': 'ListItem', position: 4, name: exam.title, item: absoluteUrl },
        ],
      },
    ],
  };

  const shareText = `📢 *${exam.title}* — ${exam.organizer}\n\nConsultez le concours complet sur TravaillerEnCi : ${absoluteUrl}`;
  const shareUrl = encodeURIComponent(absoluteUrl);

  return (
    <main className="flex-1 min-h-screen bg-gray-50 transition-colors dark:bg-slate-950">
      <ExamViewsTracker examId={exam.id} />

      {/* ============================ EN-TÊTE ============================ */}
      <section className="border-b border-gray-100 bg-emerald-500/5 dark:border-slate-800 dark:bg-emerald-500/10">
        <div className="container mx-auto max-w-4xl px-4 pb-6 pt-4 sm:pt-8">
          {/* Bannière photo par défaut selon la catégorie de concours */}
          <div className="relative h-40 sm:h-56 overflow-hidden rounded-2xl sm:rounded-3xl shadow-lg mb-5 sm:mb-6">
            <CoverImage
              src={examDefaultImage(exam.category)}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" aria-hidden="true" />
          </div>

          <nav aria-label="Fil d'Ariane" className="mb-4 sm:mb-6">
            <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-gray-500 dark:text-gray-400 sm:text-sm">
              <li>
                <Link href="/" className="hover:text-primary hover:underline">
                  Accueil
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link href="/concours" className="hover:text-primary hover:underline">
                  Concours
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  href={`/concours/categorie/${exam.category}`}
                  className="hover:text-primary hover:underline"
                >
                  {EXAM_CATEGORY_LABEL[exam.category] || 'Concours'}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li className="max-w-[40vw] truncate font-medium text-gray-700 dark:text-gray-200">
                {exam.title}
              </li>
            </ol>
          </nav>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold sm:text-sm',
                EXAM_PHASE_BADGE[phase],
              )}
            >
              {EXAM_PHASE_LABEL[phase]}
            </span>
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-gray-300 sm:text-sm">
              {EXAM_CATEGORY_LABEL[exam.category] || exam.category}
            </span>
            {exam.positions_count != null && (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-white/70 px-3 py-1 text-xs font-semibold text-gray-600 dark:border-slate-700 dark:bg-slate-800/70 dark:text-gray-300 sm:text-sm">
                {exam.positions_count} poste{exam.positions_count > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <h1 className="mb-3 font-[var(--font-display)] text-[26px] font-extrabold leading-tight text-gray-900 dark:text-white sm:text-3xl lg:text-4xl">
            {exam.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] sm:text-base">
            <div className="font-bold text-primary">{exam.organizer}</div>
            {exam.location && (
              <div className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {exam.location}
              </div>
            )}
            <div className="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
              <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>{exam.views_count} vues</span>
            </div>
            <span className="text-[11px] text-gray-400 dark:text-gray-500 sm:text-xs">
              Publié le {formatDate(exam.published_at || exam.created_at)}
            </span>
          </div>
        </div>
      </section>

      {/* ============================ CORPS ============================ */}
      <section className="container mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
          {/* Sidebar (éligibilité + CTA) en PRIORITÉ sur mobile — Core Web Vitals */}
          <aside className="order-1 space-y-5 lg:order-2 lg:sticky lg:top-24 lg:self-start">
            {/* Conditions d'éligibilité */}
            <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-black/5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                <svg className="h-5 w-5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                </svg>
                Conditions d'éligibilité
              </h3>
              <dl className="space-y-3.5 text-sm">
                {(exam.age_min != null || exam.age_max != null) && (
                  <EligRow
                    label="Âge requis"
                    value={`${exam.age_min ?? '—'} – ${exam.age_max ?? '—'} ans${exam.age_reference_date ? ` (${exam.age_reference_date})` : ''}`}
                  />
                )}
                {exam.nationality && <EligRow label="Nationalité" value={exam.nationality} />}
                {exam.diplomas.length > 0 && (
                  <div className="flex items-start justify-between gap-4">
                    <dt className="shrink-0 text-gray-500 dark:text-gray-400">Diplômes</dt>
                    <dd className="flex flex-wrap justify-end gap-1.5">
                      {exam.diplomas.map((d) => (
                        <span
                          key={d}
                          className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
                        >
                          {d}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                {exam.registration_fee && <EligRow label="Frais d'inscription" value={exam.registration_fee} />}
                {exam.exam_type && (
                  <EligRow label="Type" value={EXAM_TYPE_LABEL[exam.exam_type as keyof typeof EXAM_TYPE_LABEL] || exam.exam_type} />
                )}
                {!exam.age_min && !exam.age_max && !exam.nationality && exam.diplomas.length === 0 && (
                  <p className="text-xs text-gray-400">
                    Les conditions détaillées figurent dans le communiqué officiel ci-dessous.
                  </p>
                )}
              </dl>
            </div>

            {/* Actions */}
            <div className="space-y-2.5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-black/5 dark:border-slate-800 dark:bg-slate-900">
              {isOpen && (
                <a
                  href={exam.source_url || undefined}
                  target={exam.source_url ? '_blank' : undefined}
                  rel={exam.source_url ? 'noopener noreferrer' : undefined}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark"
                >
                  Accéder aux inscriptions officielles
                </a>
              )}

              {/* Alerte WhatsApp — canal principal en CI */}
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`📣 Je souhaite m'abonner aux alertes concours (${EXAM_CATEGORY_LABEL[exam.category] || exam.category}) sur TravaillerEnCi : ${shareText}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-400"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 2a10 10 0 0 0-8.66 15l-1.3 4.7 4.8-1.26A10 10 0 1 0 12 2Zm5.7 14.1c-.24.68-1.4 1.3-1.93 1.34-.5.05-.99.23-3.34-.7-2.83-1.1-4.62-3.97-4.76-4.15-.14-.19-1.14-1.52-1.14-2.9s.72-2.05.98-2.33c.25-.28.55-.35.74-.35h.53c.17 0 .4-.06.62.48.24.57.8 1.97.87 2.11.07.14.12.3.02.49-.1.19-.15.31-.29.48-.15.16-.31.36-.44.48-.15.15-.31.31-.13.61.17.3.78 1.29 1.68 2.09 1.15 1.03 2.12 1.35 2.42 1.5.3.15.48.13.66-.08.17-.22.76-.89.96-1.2.2-.3.4-.25.68-.15.27.1 1.73.82 2.03.97.3.15.5.22.57.34.07.13.07.72-.16 1.4Z" />
                </svg>
                S'inscrire aux alertes
              </a>

              {/* Sauvegarder ce concours */}
              <SaveButton itemType="exam" itemId={exam.id} label="Sauvegarder ce concours" className="w-full" />

              {/* Partage WhatsApp / Facebook */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366]/10 px-4 py-3 text-sm font-semibold text-[#128C7E] transition-colors hover:bg-[#25D366]/20"
                >
                  WhatsApp
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-xl bg-[#1877F2]/10 px-4 py-3 text-sm font-semibold text-[#1877F2] transition-colors hover:bg-[#1877F2]/20"
                >
                  Facebook
                </a>
              </div>

              {/* Source officielle */}
              {exam.source_url && (
                <a
                  href={exam.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50/60 px-4 py-3 text-xs text-gray-600 transition-colors hover:border-primary/30 hover:text-primary dark:border-slate-700 dark:bg-slate-800/50 dark:text-gray-300"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    Source officielle
                  </span>
                  <span className="truncate font-medium">{exam.source_website || 'Voir le communiqué'}</span>
                </a>
              )}
            </div>
          </aside>

          <article className="order-2 lg:order-1 lg:col-span-2">
            {/* Description */}
            <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-black/5 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
              <h2 className="mb-4 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
                Détails du concours
              </h2>
              <div className="prose prose-sm max-w-none leading-relaxed text-gray-700 dark:prose-invert dark:text-gray-300 sm:prose-base">
                <SimpleMarkdown text={exam.description_md || exam.seo_description || 'Communiqué en cours de rédaction.'} />
              </div>
            </div>

            {/* Mention anti-arnaque — inscriptions via les canaux officiels */}
            <SafetyNotice
              variant="exam"
              itemType="exam"
              itemId={exam.id}
              itemLabel={exam.title}
              className="mb-6"
            />

            {/* Timeline dates clés */}
            {(regStart || regEnd || examDate || resultsDate) && (
              <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-black/5 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                <h2 className="mb-5 font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
                  Dates clés
                </h2>
                <ol className="relative space-y-6 border-l-2 border-gray-100 pl-6 dark:border-slate-800">
                  {regStart && (
                    <TimelineItem
                      label="Début des inscriptions"
                      date={formatDate(exam.registration_start!)}
                      done={regStart <= now}
                      isOpen={isOpen && regStart <= now}
                    />
                  )}
                  {regEnd && (
                    <TimelineItem
                      label="Clôture des inscriptions"
                      date={formatDate(exam.registration_end!)}
                      done={regEnd <= now}
                      isOpen={isOpen}
                      highlight
                    />
                  )}
                  {examDate && (
                    <TimelineItem
                      label="Épreuves"
                      date={formatDate(exam.exam_date!)}
                      done={examDate <= now}
                    />
                  )}
                  {resultsDate && (
                    <TimelineItem
                      label="Résultats"
                      date={formatDate(exam.results_date!)}
                      done={resultsDate <= now}
                    />
                  )}
                </ol>
              </div>
            )}

            {/* Documents / annales — accès gratuit (différenciateur) */}
            {exam.documents.length > 0 && (
              <div className="mb-6 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-black/5 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
                <div className="mb-4 flex items-center gap-2">
                  <h2 className="font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
                    Documents & annales
                  </h2>
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                    Accès gratuit
                  </span>
                </div>
                <ul className="space-y-2.5">
                  {exam.documents.map((doc, i) => (
                    <li key={i}>
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5 transition-colors hover:border-primary/30 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-800/50"
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-500/10 text-rose-500">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                            <path d="M14 2v6h6" />
                          </svg>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-gray-800 dark:text-gray-200">
                            {doc.name}
                          </span>
                          <span className="text-[11px] text-gray-400">Télécharger gratuitement</span>
                        </span>
                        <svg className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M7 17 17 7" />
                          <path d="M7 7h10v10" />
                        </svg>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </div>

        {/* ============ SECTIONS SECONDARIES — streamées (lazy) ============ */}
        <div className="mt-10 space-y-10">
          <Suspense fallback={<SectionSkeleton />}>
            <LinkedJobsSection exam={exam} />
          </Suspense>
          <Suspense fallback={<SectionSkeleton />}>
            <SimilarExamsSection exam={exam} />
          </Suspense>
        </div>

        {/* Transparence */}
        {exam.confidence && (
          <p className="mt-8 text-center text-[11px] text-gray-400">
            Informations extraites du communiqué officiel — fiabilité de l'extraction :{' '}
            {EXAM_CONFIDENCE_LABEL[exam.confidence as keyof typeof EXAM_CONFIDENCE_LABEL] || exam.confidence}.
            Vérifiez toujours les modalités sur le site de l'organisateur.
          </p>
        )}
      </section>

      {/* JSON-LD (SEO) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </main>
  );
}

// =============================================================================
//  Sections secondaires — chargées en différé (Suspense) pour ne pas bloquer
//  le rendu initial (LCP) : elles n'impactent ni le score mobile ni le LCP.
// =============================================================================

async function LinkedJobsSection({ exam }: { exam: Exam }) {
  const phase = examPhase(exam);
  if (phase !== 'results') return null;

  const keywords = [
    ...(CATEGORY_JOB_KEYWORDS[exam.category] || []),
    exam.organizer.split(' ').filter((w) => w.length > 3).slice(0, 2).join(' '),
  ].filter(Boolean);

  let linkedJobs: Awaited<ReturnType<typeof JobOfferSchemaService.list>>['rows'] = [];
  for (const kw of keywords.slice(0, 2)) {
    const res = await JobOfferSchemaService.list({
      keyword: kw,
      status: 'published',
      category: ['job', 'internship'],
      limit: 3,
    });
    linkedJobs = [...linkedJobs, ...res.rows];
    if (linkedJobs.length >= 3) break;
  }
  // Déduplication par id
  linkedJobs = linkedJobs.filter((j, i, arr) => arr.findIndex((x) => x.id === j.id) === i).slice(0, 4);
  if (linkedJobs.length === 0) return null;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm shadow-black/5 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
      <div className="mb-4 flex items-center gap-2">
        <h2 className="font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white">
          Offres d'emploi liées
        </h2>
        <span className="rounded-full bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-bold text-sky-600 dark:text-sky-400">
          Résultats publiés
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {linkedJobs.map((job) => (
          <Link
            key={job.id}
            href={`/jobs/${job.id}`}
            className="group rounded-xl border border-gray-100 bg-gray-50/60 p-4 transition-colors hover:border-primary/30 hover:bg-primary/5 dark:border-slate-800 dark:bg-slate-800/50"
          >
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-gray-400">
              {job.company}
            </div>
            <div className="mb-1 line-clamp-2 text-sm font-semibold text-gray-800 transition-colors group-hover:text-primary dark:text-gray-200">
              {job.title}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {job.location} · {job.contract_type}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

async function SimilarExamsSection({ exam }: { exam: Exam }) {
  const similar = await ExamService.getSimilar(exam, 4);
  if (similar.length === 0) return null;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-[var(--font-display)] text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
          Concours similaires
        </h2>
        <Link
          href={`/concours/categorie/${exam.category}`}
          className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:underline"
        >
          Tous les concours {CATEGORY_SEO[exam.category]?.title.toLowerCase() || ''}
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {similar.map((s) => (
          <Link
            key={s.id}
            href={examUrl(s)}
            className="group rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-primary/25 hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-gray-400">{s.organizer}</span>
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-bold',
                  EXAM_PHASE_BADGE[examPhase(s)],
                )}
              >
                {EXAM_PHASE_LABEL[examPhase(s)]}
              </span>
            </div>
            <div className="line-clamp-2 text-sm font-bold text-gray-900 transition-colors group-hover:text-primary dark:text-white">
              {s.title}
            </div>
            {s.diplomas.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {s.diplomas.slice(0, 3).map((d) => (
                  <span key={d} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-500 dark:bg-slate-800 dark:text-gray-400">
                    {d}
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded-lg bg-gray-100 dark:bg-slate-800" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="h-28 rounded-2xl bg-gray-100 dark:bg-slate-800" />
        <div className="h-28 rounded-2xl bg-gray-100 dark:bg-slate-800" />
      </div>
    </div>
  );
}

// =============================================================================
//  Sous-composants UI
// =============================================================================

function TimelineItem({
  label,
  date,
  done,
  isOpen,
  highlight,
}: {
  label: string;
  date: string;
  done?: boolean;
  isOpen?: boolean;
  highlight?: boolean;
}) {
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-[31px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white dark:bg-slate-900',
          isOpen
            ? 'border-emerald-500'
            : done
              ? 'border-gray-300 dark:border-slate-700'
              : 'border-amber-400',
        )}
      >
        {isOpen && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      </span>
      <div className={cn('text-sm', highlight && 'font-semibold')}>
        <div className="text-gray-500 dark:text-gray-400">{label}</div>
        <div
          className={cn(
            'font-bold',
            isOpen
              ? 'text-emerald-600 dark:text-emerald-400'
              : done
                ? 'text-gray-400 line-through decoration-gray-300 dark:decoration-slate-700'
                : 'text-gray-800 dark:text-gray-200',
          )}
        >
          {date}
          {isOpen && <span className="ml-2 text-[11px] font-bold text-emerald-500">● en cours</span>}
        </div>
      </div>
    </li>
  );
}

function EligRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="break-words text-right font-medium text-gray-800 dark:text-gray-200">{value}</dd>
    </div>
  );
}

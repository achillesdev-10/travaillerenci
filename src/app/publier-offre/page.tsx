import Link from 'next/link';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import PublishOfferForm from './PublishOfferForm';
import type { JobOfferSchema } from '@/types';

export const revalidate = 60;

export const metadata = {
  title: 'Publier une offre — TravaillerenCi',
  description: 'Publiez votre offre d\'emploi gratuitement sur TravaillerenCi, la plateforme ivoirienne.',
};

export default async function PublierOffrePage() {
  const { rows: offersList } = await JobOfferSchemaService.list({
    status: 'published',
    limit: 12,
    order_by: 'created_at',
    order_dir: 'desc',
  });

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-gray-100 dark:border-slate-800 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="container mx-auto px-4 py-10 md:py-14 max-w-4xl">
          <div className="text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-bold mb-4 border border-blue-200/60 dark:border-blue-800/40">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
              </svg>
              Espace Recruteur — Self-Service
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white font-[var(--font-display)]">
              Publiez votre offre{' '}
              <span className="text-primary">gratuitement</span>
            </h1>
            <p className="mt-3 text-gray-600 dark:text-gray-300 text-base md:text-lg leading-relaxed">
              Créez votre offre en quelques minutes. Elle sera mise en ligne après validation par notre équipe — <strong>100% gratuit</strong> pour les PME et startups ivoiriennes.
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-8 md:py-12 max-w-3xl">
        <PublishOfferForm />

        {/* Info */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: '🆓',
              title: '100% Gratuit',
              desc: 'Publication offerte pour les PME et startups.',
            },
            {
              icon: '✅',
              title: 'Validation rapide',
              desc: 'Votre offre est examinée sous 24h.',
            },
            {
              icon: '🎯',
              title: 'Ciblage local',
              desc: 'Atteignez les candidats ivoiriens qualifiés.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 text-center shadow-sm">
              <span className="text-2xl mb-2 block">{item.icon}</span>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">{item.title}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Offres disponibles actuellement sur le site */}
      {offersList.length > 0 && (
        <section className="container mx-auto px-4 py-10 md:py-14 max-w-5xl">
          <div className="flex items-end justify-between gap-3 mb-4 sm:mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-emerald-400 mb-1">
                Offres disponibles
              </p>
              <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-tight">
                Découvrez les offres actuellement sur le site
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Voici les dernières opportunités publiées sur TravaillerenCi
              </p>
            </div>
            <Link
              href="/jobs"
              className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:gap-2 transition-all"
            >
              Toutes les offres
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {offersList.map((offer) => (
              <AvailableOfferCard key={offer.id} offer={offer} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function contractBadge(type?: string | null) {
  if (!type) return null;
  const colors: Record<string, string> = {
    CDI: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    CDD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    Stage: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
    Alternance: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    Freelance: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    Prestation: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[type] || 'bg-gray-100 text-gray-700'}`}>
      {type}
    </span>
  );
}

function AvailableOfferCard({ offer }: { offer: JobOfferSchema }) {
  return (
    <Link
      href={`/jobs/${offer.id}`}
      className="group block rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-[13px] font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {offer.title}
        </h3>
        {contractBadge(offer.contract_type)}
      </div>
      <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-1">
        {offer.company || 'Entreprise'}
      </p>
      <div className="flex items-center gap-3 text-[10px] text-gray-400 dark:text-gray-500">
        {offer.location && (
          <span className="inline-flex items-center gap-1">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {offer.location}
          </span>
        )}
      </div>
    </Link>
  );
}

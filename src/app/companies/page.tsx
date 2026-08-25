import Image from 'next/image';
import Link from 'next/link';
import SiteLogo from '@/components/companies/SiteLogo';
import { LOCAL_IMAGES } from '@/lib/images';

export const metadata = {
  title: 'Entreprises — Sites officiels de l’emploi en Côte d’Ivoire | TravaillerEnCi',
  description:
    'La liste de référence des sites officiels et portails qui publient les offres d’emploi, concours administratifs, bourses d’études et formations en Côte d’Ivoire.',
};

type OfficialSite = {
  name: string;
  domain: string;
  url: string;
  category: string;
  color: string;
};

const CATEGORIES = ['Emploi & Carrière', 'Concours & Administrations', 'Éducation & Bourses'];

const OFFICIAL_SITES: OfficialSite[] = [
  {
    name: 'Éducation & Carrière',
    domain: 'educarriere.ci',
    url: 'https://educarriere.ci',
    category: 'Emploi & Carrière',
    color: '#009639',
  },
  {
    name: 'EmploiCI',
    domain: 'emploici.ci',
    url: 'https://emploici.ci',
    category: 'Emploi & Carrière',
    color: '#F77F00',
  },
  {
    name: 'Bourse d’études',
    domain: 'boursedetude.ci',
    url: 'https://boursedetude.ci',
    category: 'Éducation & Bourses',
    color: '#003087',
  },
  {
    name: 'TravaillerEnCi',
    domain: 'travaillerenci.com',
    url: 'https://travaillerenci.com',
    category: 'Emploi & Carrière',
    color: '#059669',
  },
  {
    name: 'Envie d\'Emploi CI',
    domain: 'enviedemploi.ci',
    url: 'https://enviedemploi.ci',
    category: 'Emploi & Carrière',
    color: '#2563eb',
  },
  {
    name: 'JobsMania CI',
    domain: 'jobsmania.ci',
    url: 'https://jobsmania.ci',
    category: 'Emploi & Carrière',
    color: '#dc2626',
  },
  {
    name: 'Fonction Publique',
    domain: 'fonctionpublique.gouv.ci',
    url: 'https://www.fonctionpublique.gouv.ci',
    category: 'Concours & Administrations',
    color: '#1d4ed8',
  },
  {
    name: 'Service Public CI',
    domain: 'servicepublic.gouv.ci',
    url: 'https://servicepublic.gouv.ci',
    category: 'Concours & Administrations',
    color: '#0ea5e9',
  },
  {
    name: 'GUCACI — Concours',
    domain: 'gucaci.ciconcours.com',
    url: 'https://gucaci.ciconcours.com',
    category: 'Concours & Administrations',
    color: '#7c3aed',
  },
  {
    name: 'ENA',
    domain: 'ena.ci',
    url: 'https://www.ena.ci',
    category: 'Concours & Administrations',
    color: '#b91c1c',
  },
  {
    name: 'MEN — DECO',
    domain: 'men-deco.org',
    url: 'https://www.men-deco.org',
    category: 'Éducation & Bourses',
    color: '#059669',
  },
  {
    name: 'AIP — Agence de presse',
    domain: 'aip.ci',
    url: 'https://www.aip.ci',
    category: 'Concours & Administrations',
    color: '#334155',
  },
  {
    name: 'INFAS',
    domain: 'infas.ciconcours.com',
    url: 'https://infas.ciconcours.com',
    category: 'Éducation & Bourses',
    color: '#0891b2',
  },
  {
    name: 'INSFS',
    domain: 'insfs.ciconcours.com',
    url: 'https://insfs.ciconcours.com',
    category: 'Éducation & Bourses',
    color: '#a16207',
  },
  {
    name: 'Défense — Concours',
    domain: 'concours-defense.ciconcours.com',
    url: 'https://concours-defense.ciconcours.com',
    category: 'Concours & Administrations',
    color: '#166534',
  },
  {
    name: 'CAFOP / DECO',
    domain: 'cafop.deco.ci',
    url: 'https://cafop.deco.ci',
    category: 'Éducation & Bourses',
    color: '#ca8a04',
  },
  {
    name: 'INJS — Jeunesse & Sports',
    domain: 'injs.ci',
    url: 'https://injs.ci',
    category: 'Concours & Administrations',
    color: '#ea580c',
  },
  {
    name: 'CNPS — Social',
    domain: 'cnps.ci',
    url: 'https://www.cnps.ci',
    category: 'Concours & Administrations',
    color: '#0369a1',
  },
  {
    name: 'Caisse Nationale de Crédit Agricole',
    domain: 'cnca.ci',
    url: 'https://www.cnca.ci',
    category: 'Emploi & Carrière',
    color: '#15803d',
  },
  {
    name: 'BIDC — Banque de Développement',
    domain: 'bidc.ci',
    url: 'https://www.bidc.ci',
    category: 'Emploi & Carrière',
    color: '#1e40af',
  },
  {
    name: 'SODECI — Eau & Assainissement',
    domain: 'sodeci.ci',
    url: 'https://www.sodeci.ci',
    category: 'Emploi & Carrière',
    color: '#0284c7',
  },
];

function SiteCard({ site }: { site: OfficialSite }) {
  return (
    <a
      href={site.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-4 rounded-2xl border border-border bg-white dark:bg-slate-900 p-5 shadow-sm hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/40 transition-all duration-200"
    >
      <SiteLogo name={site.name} domain={site.domain} color={site.color} />
      <div className="min-w-0 flex-1">
        <h3 className="font-bold text-gray-900 dark:text-white truncate group-hover:text-primary transition-colors">
          {site.name}
        </h3>
        <div className="text-xs text-gray-500 dark:text-slate-400 mt-0.5 truncate">
          {site.domain}
        </div>
      </div>
      <span
        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500 dark:text-slate-300 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all"
        aria-hidden="true"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </span>
    </a>
  );
}

export default function CompaniesPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <nav className="text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-primary">
          Accueil
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900 dark:text-white font-medium">Entreprises</span>
      </nav>

      <div className="mb-10 max-w-3xl">
        <span className="inline-flex rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-600 dark:text-orange-400 border border-orange-500/20 mb-4">
          Sites officiels vérifiés
        </span>
        <h1 className="text-3xl md:text-4xl font-bold mb-4 font-[var(--font-display)] text-gray-900 dark:text-white">
          Les sites officiels de l’emploi en Côte d’Ivoire
        </h1>
        <p className="text-gray-600 dark:text-slate-400 text-lg">
          La liste de référence des plateformes et portails officiels qui publient les offres
          d’emploi, les concours administratifs, les bourses d’études et les formations en
          Côte d’Ivoire. Cliquez sur un site pour y accéder directement.
        </p>
      </div>

      {CATEGORIES.map((category) => {
        const sites = OFFICIAL_SITES.filter((site) => site.category === category);
        if (sites.length === 0) return null;
        return (
          <section key={category} className="mb-10">
            <h2 className="text-xl font-bold font-[var(--font-display)] text-gray-900 dark:text-white mb-4">
              {category}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sites.map((site) => (
                <SiteCard key={site.domain} site={site} />
              ))}
            </div>
          </section>
        );
      })}

      <div className="relative overflow-hidden rounded-3xl border border-border bg-white dark:bg-slate-900 mt-12">
        <div className="grid lg:grid-cols-2 items-stretch">
          {/* Visuel — bannière locale optimisée (mobile : bandeau discret) */}
          <div className="relative h-48 lg:h-auto overflow-hidden">
            <Image
              src={LOCAL_IMAGES.recruiterSection}
              alt="Entreprise et recruteur — publier une offre d'emploi sur TravaillerEnCi"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent lg:bg-gradient-to-r lg:from-transparent lg:to-white/20 dark:lg:to-slate-900/20" aria-hidden="true" />
          </div>
          <div className="p-8 lg:p-12 text-center lg:text-left flex flex-col items-center lg:items-start justify-center">
            <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary dark:text-emerald-400 border border-primary/20 mb-4">
              Espace Recruteur
            </span>
            <h2 className="text-xl lg:text-2xl font-bold font-[var(--font-display)] text-gray-900 dark:text-white">
              Vous êtes une entreprise ou un recruteur ?
            </h2>
            <p className="text-gray-600 dark:text-slate-400 mt-2 mb-6 max-w-xl text-sm leading-relaxed">
              TravaillerEnCi regroupe ici les meilleures opportunités de la Côte d’Ivoire.
              Publiez vos offres et touchez des milliers de candidats qualifiés.
            </p>
            <Link
              href="/register"
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-dark text-white px-8 py-3 rounded-xl font-semibold shadow-md shadow-primary/20 transition-all"
            >
              Publier une offre
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

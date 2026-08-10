import { getSiteUrl } from './site';

const COUNTRIES: Record<string, string> = {
  CI: 'Côte d\'Ivoire',
};

const REGIONS_CI: Array<{ slug: string; name: string; department?: string }> = [
  { slug: 'abidjan', name: 'Abidjan' },
  { slug: 'yamoussoukro', name: 'Yamoussoukro' },
  { slug: 'bouake', name: 'Bouaké' },
  { slug: 'san-pedro', name: 'San-Pédro' },
  { slug: 'daloa', name: 'Daloa' },
  { slug: 'korhogo', name: 'Korhogo' },
  { slug: 'man', name: 'Man' },
  { slug: 'gagnoa', name: 'Gagnoa' },
  { slug: 'abobo', name: 'Abobo' },
  { slug: 'cocody', name: 'Cocody' },
  { slug: 'plateau', name: 'Le Plateau' },
  { slug: 'treichville', name: 'Treichville' },
  { slug: 'port-bouet', name: 'Port-Bouët' },
  { slug: 'koumassi', name: 'Koumassi' },
  { slug: 'adjame', name: 'Adjamé' },
  { slug: 'yopougon', name: 'Yopougon' },
  { slug: 'marcory', name: 'Marcory' },
  { slug: 'anyama', name: 'Anyama' },
  { slug: 'bingerville', name: 'Bingerville' },
];

const SECTORS: Array<{ slug: string; name: string }> = [
  { slug: 'it-digital', name: 'IT / Digital' },
  { slug: 'banque-finance', name: 'Banque / Finance' },
  { slug: 'btp-immobilier', name: 'BTP / Immobilier' },
  { slug: 'industrie', name: 'Industrie' },
  { slug: 'commerce-distribution', name: 'Commerce / Distribution' },
  { slug: 'sante', name: 'Santé' },
  { slug: 'education-formation', name: 'Education / Formation' },
  { slug: 'agroalimentaire', name: 'Agroalimentaire / Agriculture' },
  { slug: 'telecoms', name: 'Télécoms' },
  { slug: 'transport-logistique', name: 'Transport / Logistique' },
  { slug: 'tourisme-hotellerie', name: 'Tourisme / Hôtellerie' },
  { slug: 'audiovisuel-medias', name: 'Audiovisuel / Médias' },
  { slug: 'audit-conseil', name: 'Audit / Conseil' },
  { slug: 'juridique', name: 'Juridique' },
  { slug: 'rh', name: 'Ressources Humaines' },
  { slug: 'marketing-communication', name: 'Marketing / Communication' },
];

const JOB_TYPES: Array<{ value: string; label: string }> = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'Stage', label: 'Stage' },
  { value: 'Alternance', label: 'Alternance' },
  { value: 'Freelance', label: 'Freelance / Mission' },
  { value: 'Temps plein', label: 'Temps plein' },
  { value: 'Temps partiel', label: 'Temps partiel' },
];

const JOB_LEVELS: Array<{ value: string; label: string }> = [
  { value: 'Junior', label: 'Junior (0-2 ans)' },
  { value: 'Intermédiaire', label: 'Intermédiaire (2-5 ans)' },
  { value: 'Senior', label: 'Senior (5-10 ans)' },
  { value: 'Expert', label: 'Expert (10+ ans)' },
  { value: 'Manager', label: 'Manager' },
  { value: 'Cadre dirigeant', label: 'Cadre dirigeant' },
];

const COMPANY_SIZES: Array<{ value: string; label: string }> = [
  { value: '1-10', label: '1 à 10 salariés (Startup)' },
  { value: '11-50', label: '11 à 50 salariés (PME)' },
  { value: '51-200', label: '51 à 200 salariés (Moyenne entreprise)' },
  { value: '201-500', label: '201 à 500 salariés (ETI)' },
  { value: '501-1000', label: '501 à 1000 salariés' },
  { value: '1000+', label: 'Plus de 1000 salariés (Grand groupe)' },
];

const EDUCATION_LEVELS: Array<{ value: string; label: string }> = [
  { value: 'baccalaureat', label: 'Baccalauréat' },
  { value: 'bts_dut', label: 'BTS / DUT' },
  { value: 'licence', label: 'Licence (Bac+3)' },
  { value: 'master', label: 'Master (Bac+5)' },
  { value: 'doctorat', label: 'Doctorat' },
  { value: 'other', label: 'Autre' },
];

const REMOTE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'no', label: 'Sur site uniquement' },
  { value: 'partial', label: 'Hybride / Télétravail partiel' },
  { value: 'full', label: '100% télétravail' },
];

const SITE_CONFIG = {
  name: 'TravaillerenCi',
  description: 'Plateforme d\'offres d\'emploi en Côte d\'Ivoire',
  // Domaine actuel (vercel.app) — bascule via NEXT_PUBLIC_SITE_URL quand .ci sera actif.
  url: getSiteUrl(),
  supportEmail: 'achillesdev10@gmail.com',
  // Pas de numéro de téléphone pour le moment.
  phone: '',
  address: 'Abidjan, Côte d\'Ivoire',
  social: {
    facebook: 'https://web.facebook.com/travaillerenci/',
    linkedin: 'https://www.linkedin.com/in/travailler-en-ci/',
    tiktok: 'https://www.tiktok.com/@travaillerenci',
    whatsapp: 'https://whatsapp.com/channel/0029VbD3xgrCMY0E3eGtOR0U',
  },
  currency: 'FCFA',
};

export {
  COUNTRIES,
  REGIONS_CI,
  SECTORS,
  JOB_TYPES,
  JOB_LEVELS,
  COMPANY_SIZES,
  EDUCATION_LEVELS,
  REMOTE_OPTIONS,
  SITE_CONFIG,
};

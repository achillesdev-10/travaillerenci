/**
 *  TravaillerEnCi — src/lib/jobSeo.ts
 *
 *  Pages d'atterrissage SEO offres : villes, métiers et combinaisons
 *  métier × ville (ex : /emplois-abidjan, /emplois-informatique,
 *  /emplois-informatique-abidjan, /stages-sante-bouake).
 *
 *  Règles anti-duplication / anti-pages-pauvres (master prompt §12) :
 *    • Une page n'existe que si elle dépasse un seuil d'offres RÉELLES
 *      (`MIN_OFFERS`, et `MIN_COMBO_OFFERS` plus strict pour les combinaisons).
 *    • Titre, description, intro éditoriale et maillage sont propres à chaque
 *      page (jamais de texte générique dupliqué à l'identique).
 *
 *  Module PUR (aucun import serveur / Next) → directement testable.
 *  La correspondance métier réutilise `SECTOR_KEYWORDS` de
 *  recommendationScoring.ts (source unique des mots-clés par secteur).
 */

import {
  SECTOR_KEYWORDS,
  matchesCity,
  matchesKeyword,
  normalizeText,
} from '@/lib/recommendationScoring';
import type { ContentCategory } from '@/types/content-types';

export type JobSeoActivity = 'emplois' | 'stages';

/** Seuils anti-pages-vides (nombre minimal d'offres réelles pour indexer). */
export const MIN_OFFERS = 5;
export const MIN_COMBO_OFFERS = 8;

/** Catégories de contenu (`category` de job_offers) couvertes par activité. */
export function categoriesForActivity(activity: JobSeoActivity): ContentCategory[] {
  return activity === 'stages' ? ['internship'] : ['job'];
}

// ---------------------------------------------------------------------------
//  Villes
// ---------------------------------------------------------------------------
export interface CitySeo {
  slug: string;
  name: string;
  description: string;
  intro: string[];
  keywords: string[];
}

export const CITY_SEO: CitySeo[] = [
  {
    slug: 'abidjan',
    name: 'Abidjan',
    description:
      "Offres d'emploi et de stage à Abidjan : banques, télécoms, industrie, ONG et PME de la capitale économique ivoirienne. Postulez aux recrutements du Plateau, de Cocody, Yopougon et Koumassi.",
    intro: [
      "Abidjan concentre la grande majorité des recrutements en Côte d'Ivoire : sièges des banques, opérateurs télécoms, groupes industriels et organisations internationales, du Plateau à Cocody en passant par les zones d'activité de Yopougon et Koumassi.",
      'Que vous cherchiez un stage, un premier emploi ou un poste de cadre, les opportunités publiées dans la capitale économique sont rassemblées ici et mises à jour en continu.',
    ],
    keywords: ['emploi Abidjan', "offre d'emploi Abidjan", 'recrutement Abidjan', 'stage Abidjan'],
  },
  {
    slug: 'bouake',
    name: 'Bouaké',
    description:
      "Offres d'emploi à Bouaké et dans le centre de la Côte d'Ivoire : commerce, distribution, santé, enseignement et transport. Trouvez un travail près de chez vous à Bouaké.",
    intro: [
      "Deuxième ville du pays, Bouaké est un pôle commercial et administratif majeur du centre ivoirien. La distribution, le transport, la santé et l'enseignement y recrutent régulièrement.",
      'Cette page rassemble les offres publiées à Bouaké et dans ses environs, actualisées au fil des publications.',
    ],
    keywords: ['emploi Bouaké', "offre d'emploi Bouaké", 'recrutement Bouaké', 'travail Bouaké'],
  },
  {
    slug: 'yamoussoukro',
    name: 'Yamoussoukro',
    description:
      "Offres d'emploi à Yamoussoukro, capitale politique de la Côte d'Ivoire : administrations, institutions, éducation et services. Consultez les recrutements de la ville.",
    intro: [
      "Capitale politique du pays, Yamoussoukro accueille les administrations centrales, les grandes institutions et un tissu croissant de PME de services.",
      "Les opportunités y sont particulièrement nombreuses dans l'administration, l'éducation, la santé et les services aux entreprises.",
    ],
    keywords: [
      'emploi Yamoussoukro',
      "offre d'emploi Yamoussoukro",
      'recrutement Yamoussoukro',
    ],
  },
  {
    slug: 'san-pedro',
    name: 'San-Pédro',
    description:
      "Offres d'emploi à San-Pédro : logistique portuaire, export de cacao, industrie et services. Découvrez les recrutements de l'Ouest ivoirien.",
    intro: [
      "Port et poumon économique de l'Ouest, San-Pédro vit au rythme de l'export du cacao, de la logistique portuaire et de l'industrie de transformation.",
      'Les offres publiées ici couvrent le transit, les opérations portuaires, la production et les services.',
    ],
    keywords: [
      'emploi San-Pédro',
      "offre d'emploi San-Pédro",
      'recrutement San-Pédro',
      'logistique portuaire CI',
    ],
  },
  {
    slug: 'daloa',
    name: 'Daloa',
    description:
      "Offres d'emploi à Daloa, carrefour agricole et commercial du Centre-Ouest ivoirien. Consultez les recrutements locaux.",
    intro: [
      "Située au cœur du Haut-Sassandra, Daloa est un important carrefour agricole et commercial du Centre-Ouest ivoirien.",
      "Les recrutements y concernent surtout l'agro-industrie, le commerce et les services de proximité.",
    ],
    keywords: ['emploi Daloa', "offre d'emploi Daloa", 'recrutement Daloa'],
  },
  {
    slug: 'korhogo',
    name: 'Korhogo',
    description:
      "Offres d'emploi à Korhogo, capitale du Nord ivoirien : agro-industrie, coton, santé, éducation et administration.",
    intro: [
      "Korhogo, capitale régionale du Nord, combine activité administrative, filière coton et commerce transfrontalier.",
      "Les offres publiées dans la région portent principalement sur l'agro-industrie, la santé et l'éducation.",
    ],
    keywords: ['emploi Korhogo', "offre d'emploi Korhogo", 'recrutement Korhogo'],
  },
  {
    slug: 'man',
    name: 'Man',
    description:
      "Offres d'emploi à Man, dans la région du Tonkpi : agro-industrie (café, cacao, hévéa), tourisme et services.",
    intro: [
      "Man, chef-lieu du Tonkpi, est réputée pour son agro-industrie (café, cacao, hévéa) et son potentiel touristique.",
      "Les recrutements locaux se concentrent sur les filières agricoles, le tourisme et les services.",
    ],
    keywords: ['emploi Man', "offre d'emploi Man", 'recrutement Man Tonkpi'],
  },
  {
    slug: 'gagnoa',
    name: 'Gagnoa',
    description:
      "Offres d'emploi à Gagnoa, centre administratif et agricole de la région du Gôh, dans le Centre-Ouest ivoirien.",
    intro: [
      "Gagnoa, dans la région du Gôh, est un centre administratif et agricole majeur du Centre-Ouest ivoirien.",
      "La ville recrute principalement dans l'agriculture, le commerce et les services publics.",
    ],
    keywords: ['emploi Gagnoa', "offre d'emploi Gagnoa", 'recrutement Gagnoa'],
  },
];

// ---------------------------------------------------------------------------
//  Métiers (adossés aux slugs de SECTORS pour réutiliser les mots-clés)
// ---------------------------------------------------------------------------
export interface MetierSeo {
  slug: string;
  /** Slug de secteur correspondant dans SECTOR_KEYWORDS. */
  sector: string;
  label: string;
  /** Terme de recherche pour renvoyer vers /jobs?q=… */
  searchKeyword: string;
  description: string;
  intro: string[];
  keywords: string[];
}

export const METIER_SEO: MetierSeo[] = [
  {
    slug: 'informatique',
    sector: 'it-digital',
    label: 'Informatique / Digital',
    searchKeyword: 'développeur',
    description:
      "Offres d'emploi en informatique en Côte d'Ivoire : développeurs, data analysts, techniciens réseaux, support et DevOps. Postulez dans les ESN, banques et télécoms.",
    intro: [
      "Développeurs, data analysts, techniciens réseaux et support informatique sont très recherchés par les banques, opérateurs télécoms, ESN et start-ups ivoiriennes.",
      "Retrouvez ici les offres du numérique publiées en Côte d'Ivoire, d'Abidjan à l'intérieur du pays.",
    ],
    keywords: [
      "emploi informatique Côte d'Ivoire",
      'offre développeur CI',
      'recrutement IT Abidjan',
      'emploi data analyst',
    ],
  },
  {
    slug: 'comptabilite-finance',
    sector: 'banque-finance',
    label: 'Comptabilité / Finance',
    searchKeyword: 'comptable',
    description:
      "Offres d'emploi en comptabilité et finance en Côte d'Ivoire : comptables, auditeurs, contrôleurs de gestion et analystes financiers.",
    intro: [
      "Comptables, auditeurs, contrôleurs de gestion et analystes financiers sont recherchés par les entreprises, cabinets d'audit et institutions financières ivoiriennes.",
      "Cette page rassemble les offres de la comptabilité, de la banque et de la finance.",
    ],
    keywords: [
      'emploi comptable CI',
      'offre audit Côte d’Ivoire',
      'recrutement finance Abidjan',
      'emploi contrôleur de gestion',
    ],
  },
  {
    slug: 'commerce-vente',
    sector: 'commerce-distribution',
    label: 'Commerce / Vente',
    searchKeyword: 'commercial',
    description:
      "Offres d'emploi dans le commerce et la vente en Côte d'Ivoire : commerciaux, vendeurs, chefs de rayon et chargés de clientèle.",
    intro: [
      "Commerciaux, vendeurs, chefs de rayon et chargés de clientèle : la distribution et la vente figurent parmi les métiers les plus recrutés en Côte d'Ivoire.",
      "Découvrez les postes ouverts dans la grande distribution, le commerce de détail et la vente B2B.",
    ],
    keywords: [
      'emploi commercial CI',
      'offre vendeur Abidjan',
      'recrutement distribution Côte d’Ivoire',
    ],
  },
  {
    slug: 'marketing-communication',
    sector: 'marketing-communication',
    label: 'Marketing / Communication',
    searchKeyword: 'marketing',
    description:
      "Offres d'emploi en marketing et communication en Côte d'Ivoire : chargés de communication, community managers, graphistes et spécialistes du digital.",
    intro: [
      "Chargés de communication, community managers, graphistes et spécialistes du marketing digital accompagnent la transformation des marques ivoiriennes.",
      "Les postes ouverts couvrent la communication institutionnelle, le digital et la création.",
    ],
    keywords: [
      'emploi marketing CI',
      'offre communication Abidjan',
      'emploi community manager Côte d’Ivoire',
    ],
  },
  {
    slug: 'rh',
    sector: 'rh',
    label: 'Ressources Humaines',
    searchKeyword: 'ressources humaines',
    description:
      "Offres d'emploi en ressources humaines en Côte d'Ivoire : gestionnaires RH, recruteurs, responsables paie et formation.",
    intro: [
      "Gestionnaires RH, recruteurs et responsables paie : les fonctions ressources humaines se développent avec la structuration des entreprises ivoiriennes.",
      "Retrouvez ici les offres de recrutement, de paie et de développement des compétences.",
    ],
    keywords: [
      'emploi RH CI',
      'offre recrutement Abidjan',
      'emploi ressources humaines Côte d’Ivoire',
    ],
  },
  {
    slug: 'btp',
    sector: 'btp-immobilier',
    label: 'BTP / Immobilier',
    searchKeyword: 'chantier',
    description:
      "Offres d'emploi dans le BTP et l'immobilier en Côte d'Ivoire : maçons, électriciens, conducteurs de travaux et ingénieurs génie civil.",
    intro: [
      "Maçons, électriciens, conducteurs de travaux et ingénieurs génie civil : la construction et l'immobilier tirent la croissance ivoirienne.",
      "Les offres publiées couvrent les chantiers, la promotion immobilière et les métiers techniques du bâtiment.",
    ],
    keywords: ['emploi BTP CI', 'offre génie civil Abidjan', 'emploi chantier Côte d’Ivoire'],
  },
  {
    slug: 'transport-logistique',
    sector: 'transport-logistique',
    label: 'Transport / Logistique',
    searchKeyword: 'logistique',
    description:
      "Offres d'emploi en transport et logistique en Côte d'Ivoire : chauffeurs, transitaires, magasiniers et responsables supply chain.",
    intro: [
      "Chauffeurs, transitaires, magasiniers et responsables supply chain : le transport et la logistique s'appuient sur les ports d'Abidjan et de San-Pédro.",
      "Découvrez les offres du fret, du transit et de la gestion d'entrepôt.",
    ],
    keywords: [
      'emploi logistique CI',
      'offre transport Abidjan',
      'emploi transitaire Côte d’Ivoire',
    ],
  },
  {
    slug: 'sante',
    sector: 'sante',
    label: 'Santé',
    searchKeyword: 'infirmier',
    description:
      "Offres d'emploi dans la santé en Côte d'Ivoire : infirmiers, médecins, pharmaciens et techniciens de laboratoire.",
    intro: [
      "Infirmiers, médecins, pharmaciens et techniciens de laboratoire : le secteur de la santé recrute dans les cliniques, hôpitaux et structures privées.",
      "Les offres publiées couvrent le soin, la biologie et la pharmacie.",
    ],
    keywords: ['emploi santé CI', 'offre infirmier Abidjan', 'recrutement clinique Côte d’Ivoire'],
  },
  {
    slug: 'enseignement',
    sector: 'education-formation',
    label: 'Enseignement / Formation',
    searchKeyword: 'enseignant',
    description:
      "Offres d'emploi dans l'enseignement et la formation en Côte d'Ivoire : enseignants, formateurs et éducateurs, public et privé.",
    intro: [
      "Enseignants, formateurs et éducateurs : l'éducation et la formation professionnelle recrutent dans le public comme dans le privé.",
      "Cette page rassemble les postes d'enseignement, de formation et d'encadrement éducatif.",
    ],
    keywords: ['emploi enseignant CI', 'offre formateur Abidjan', 'recrutement éducation Côte d’Ivoire'],
  },
  {
    slug: 'industrie',
    sector: 'industrie',
    label: 'Industrie',
    searchKeyword: 'maintenance',
    description:
      "Offres d'emploi dans l'industrie en Côte d'Ivoire : techniciens de maintenance, opérateurs de production et responsables qualité.",
    intro: [
      "Techniciens de maintenance, opérateurs de production et responsables qualité : l'industrie ivoirienne recrute dans l'agro-alimentaire, l'emballage et la transformation.",
      "Les offres couvrent la production, la maintenance et le contrôle qualité.",
    ],
    keywords: [
      'emploi industrie CI',
      'offre technicien maintenance Abidjan',
      'recrutement production Côte d’Ivoire',
    ],
  },
  {
    slug: 'juridique',
    sector: 'juridique',
    label: 'Juridique',
    searchKeyword: 'juriste',
    description:
      "Offres d'emploi juridiques en Côte d'Ivoire : juristes, assistants juridiques et spécialistes de la conformité.",
    intro: [
      "Juristes, assistants juridiques et spécialistes de la conformité : les entreprises et cabinets ivoiriens recherchent des profils de droit.",
      "Les postes ouverts concernent le conseil, le contentieux et la conformité réglementaire.",
    ],
    keywords: ['emploi juriste CI', 'offre juridique Abidjan', 'recrutement droit Côte d’Ivoire'],
  },
  {
    slug: 'hotellerie-restauration',
    sector: 'tourisme-hotellerie',
    label: 'Hôtellerie / Restauration',
    searchKeyword: 'cuisinier',
    description:
      "Offres d'emploi en hôtellerie et restauration en Côte d'Ivoire : serveurs, cuisiniers, réceptionnistes et gouvernantes.",
    intro: [
      "Serveurs, cuisiniers, réceptionnistes et gouvernantes : l'hôtellerie-restauration recrute à Abidjan et dans les zones touristiques du pays.",
      "Découvrez les offres des hôtels, restaurants et établissements de loisirs.",
    ],
    keywords: [
      'emploi hôtellerie CI',
      'offre restauration Abidjan',
      'recrutement serveur Côte d’Ivoire',
    ],
  },
  {
    slug: 'agriculture',
    sector: 'agroalimentaire',
    label: 'Agriculture / Agro-industrie',
    searchKeyword: 'agricole',
    description:
      "Offres d'emploi dans l'agriculture et l'agro-industrie en Côte d'Ivoire : agronomes, techniciens agricoles et chefs de plantation.",
    intro: [
      "Agronomes, techniciens agricoles et chefs de plantation : l'agro-industrie emploie une part importante de la main-d'œuvre ivoirienne.",
      "Les offres publiées couvrent les cultures de rente, l'élevage et la transformation agro-alimentaire.",
    ],
    keywords: [
      'emploi agriculture CI',
      'offre agronome Côte d’Ivoire',
      'recrutement agro-industrie',
    ],
  },
  {
    slug: 'telecoms',
    sector: 'telecoms',
    label: 'Télécoms',
    searchKeyword: 'télécom',
    description:
      "Offres d'emploi en télécoms en Côte d'Ivoire : techniciens réseaux, ingénieurs télécoms et conseillers clientèle.",
    intro: [
      "Techniciens réseaux, ingénieurs télécoms et conseillers clientèle : le secteur des télécoms recrute chez les opérateurs et leurs sous-traitants.",
      "Les offres couvrent le déploiement réseau, la maintenance et la relation client.",
    ],
    keywords: [
      'emploi télécoms CI',
      'offre technicien réseau Abidjan',
      'recrutement télécom Côte d’Ivoire',
    ],
  },
];

// ---------------------------------------------------------------------------
//  Index / parsing
// ---------------------------------------------------------------------------
export const CITY_SEO_BY_SLUG: Record<string, CitySeo> = Object.fromEntries(
  CITY_SEO.map((c) => [c.slug, c]),
);
export const METIER_SEO_BY_SLUG: Record<string, MetierSeo> = Object.fromEntries(
  METIER_SEO.map((m) => [m.slug, m]),
);

export interface ParsedJobSeoSlug {
  activity: JobSeoActivity;
  citySlug: string | null;
  metierSlug: string | null;
}

/**
 * Analyse un slug d'URL. Retourne null si le slug n'est pas une page SEO
 * valide (ce qui déclenche un 404 — aucune page inventée).
 *
 * Grammaire : `{activity}-{ville?}-{métier?}` dans n'importe quel ordre,
 * avec au moins un segment ville ou métier.
 */
export function parseJobSeoSlug(slug: string): ParsedJobSeoSlug | null {
  const activity: JobSeoActivity | null = slug.startsWith('emplois-')
    ? 'emplois'
    : slug.startsWith('stages-')
      ? 'stages'
      : null;
  if (!activity) return null;

  const rest = slug.slice(activity.length + 1);
  if (!rest) return null;

  // Résolution par égalité exacte de slugs (gère les slugs multi-mots).
  const citySlugs = CITY_SEO.map((c) => c.slug);
  const metierSlugs = METIER_SEO.map((m) => m.slug);

  // Ville seule / métier seul
  if (citySlugs.includes(rest)) return { activity, citySlug: rest, metierSlug: null };
  if (metierSlugs.includes(rest)) return { activity, citySlug: null, metierSlug: rest };

  // Combinaisons ville × métier (les deux ordres)
  for (const c of citySlugs) {
    for (const m of metierSlugs) {
      if (rest === `${c}-${m}` || rest === `${m}-${c}`) {
        return { activity, citySlug: c, metierSlug: m };
      }
    }
  }

  return null;
}

/** Construit le slug canonique d'une page (ordre ville puis métier). */
export function buildJobSeoSlug(parsed: ParsedJobSeoSlug): string {
  const parts: string[] = [parsed.activity];
  if (parsed.citySlug) parts.push(parsed.citySlug);
  if (parsed.metierSlug) parts.push(parsed.metierSlug);
  return parts.join('-');
}

// ---------------------------------------------------------------------------
//  Filtrage / scoring d'éligibilité
// ---------------------------------------------------------------------------
export interface SeoOfferLike {
  id?: string;
  category?: string | null;
  /** Slug de métier/domaine (job_offers.sector) — prioritaire s'il est renseigné. */
  sector?: string | null;
  title: string;
  description?: string | null;
  location?: string | null;
}

function offerHaystack(offer: SeoOfferLike): string {
  return normalizeText(`${offer.title} ${offer.description ?? ''}`);
}

/** Vrai si l'offre correspond au métier (colonne sector ou repli mots-clés). */
function matchesMetier(offer: SeoOfferLike, metierSlug: string): boolean {
  const entry = METIER_SEO_BY_SLUG[metierSlug];
  if (!entry) return false;
  // 1) Colonne sector renseignée → correspondance exacte.
  if (offer.sector) return offer.sector === entry.sector;
  // 2) Repli : mots-clés du secteur sur titre + description.
  const sector = SECTOR_KEYWORDS[entry.sector];
  if (!sector) return false;
  const haystack = offerHaystack(offer);
  return sector.keywords.some((kw) => matchesKeyword(haystack, normalizeText(kw)));
}

/** Vrai si la catégorie de contenu de l'offre correspond à l'activité. */
function matchesActivity(offer: SeoOfferLike, activity: JobSeoActivity): boolean {
  const expected = categoriesForActivity(activity);
  const actual = offer.category || 'job';
  return (expected as readonly string[]).includes(actual);
}

/** Filtre une liste d'offres pour une page SEO donnée. */
export function filterOffersForSeo<T extends SeoOfferLike>(
  offers: T[],
  parsed: ParsedJobSeoSlug,
): T[] {
  const city = parsed.citySlug ? CITY_SEO_BY_SLUG[parsed.citySlug] : null;
  return offers.filter((offer) => {
    if (!matchesActivity(offer, parsed.activity)) return false;
    if (city && !matchesCity(offer.location, city.name)) return false;
    if (parsed.metierSlug && !matchesMetier(offer, parsed.metierSlug)) return false;
    return true;
  });
}

/** Seuil requis selon le type de page (combinaison = plus strict). */
export function minOffersFor(parsed: ParsedJobSeoSlug): number {
  return parsed.citySlug && parsed.metierSlug ? MIN_COMBO_OFFERS : MIN_OFFERS;
}

// ---------------------------------------------------------------------------
//  Libellés / métadonnées
// ---------------------------------------------------------------------------
export function seoLandingTitle(parsed: ParsedJobSeoSlug): string {
  const city = parsed.citySlug ? CITY_SEO_BY_SLUG[parsed.citySlug] : null;
  const metier = parsed.metierSlug ? METIER_SEO_BY_SLUG[parsed.metierSlug] : null;
  const noun = parsed.activity === 'stages' ? 'Offres de stage' : "Offres d'emploi";

  if (metier && city) return `${noun} ${metier.label} à ${city.name}`;
  if (metier) return `${noun} ${metier.label} en Côte d'Ivoire`;
  if (city) return `${noun} à ${city.name}`;
  return noun;
}

export function seoLandingDescription(parsed: ParsedJobSeoSlug): string {
  const city = parsed.citySlug ? CITY_SEO_BY_SLUG[parsed.citySlug] : null;
  const metier = parsed.metierSlug ? METIER_SEO_BY_SLUG[parsed.metierSlug] : null;

  if (metier && city) {
    return `${seoLandingTitle(parsed)} : recrutements ${metier.label.toLowerCase()} à ${city.name}, mis à jour régulièrement. Missions, profil recherché et candidature en ligne sur TravaillerEnCi.`;
  }
  return city ? city.description : metier!.description;
}

export function seoLandingKeywords(parsed: ParsedJobSeoSlug): string[] {
  const city = parsed.citySlug ? CITY_SEO_BY_SLUG[parsed.citySlug] : null;
  const metier = parsed.metierSlug ? METIER_SEO_BY_SLUG[parsed.metierSlug] : null;
  const out = new Set<string>();
  if (metier) metier.keywords.forEach((k) => out.add(k));
  if (city) city.keywords.forEach((k) => out.add(k));
  if (metier && city) out.add(`${metier.label} ${city.name}`);
  return Array.from(out).slice(0, 10);
}

/** Paragraphes éditoriaux uniques de la page. */
export function seoLandingIntro(parsed: ParsedJobSeoSlug): string[] {
  const city = parsed.citySlug ? CITY_SEO_BY_SLUG[parsed.citySlug] : null;
  const metier = parsed.metierSlug ? METIER_SEO_BY_SLUG[parsed.metierSlug] : null;
  if (city && metier) {
    return [
      `Cette page rassemble les ${seoLandingTitle(parsed).toLowerCase()} publiées sur TravaillerEnCi.`,
      ...metier.intro.slice(0, 1),
      ...city.intro.slice(0, 1),
    ];
  }
  if (city) return city.intro;
  return metier!.intro;
}

/** Toutes les pages SEO possibles (bases + combinaisons). */
export function listAllSeoLandings(): Array<ParsedJobSeoSlug & { slug: string }> {
  const out: Array<ParsedJobSeoSlug & { slug: string }> = [];
  const activities: JobSeoActivity[] = ['emplois', 'stages'];

  for (const activity of activities) {
    for (const c of CITY_SEO) {
      const parsed: ParsedJobSeoSlug = { activity, citySlug: c.slug, metierSlug: null };
      out.push({ ...parsed, slug: buildJobSeoSlug(parsed) });
    }
    for (const m of METIER_SEO) {
      const parsed: ParsedJobSeoSlug = { activity, citySlug: null, metierSlug: m.slug };
      out.push({ ...parsed, slug: buildJobSeoSlug(parsed) });
    }
    for (const c of CITY_SEO) {
      for (const m of METIER_SEO) {
        const parsed: ParsedJobSeoSlug = { activity, citySlug: c.slug, metierSlug: m.slug };
        out.push({ ...parsed, slug: buildJobSeoSlug(parsed) });
      }
    }
  }
  return out;
}

/**
 * Slugs des pages atteignant le seuil d'offres requis (utilisé pour le
 * sitemap : on n'annonce jamais une page vide aux moteurs).
 */
export function eligibleSeoLandings<T extends SeoOfferLike>(
  offers: T[],
): Array<ParsedJobSeoSlug & { slug: string }> {
  return listAllSeoLandings().filter((landing) => {
    const parsed: ParsedJobSeoSlug = {
      activity: landing.activity,
      citySlug: landing.citySlug,
      metierSlug: landing.metierSlug,
    };
    return filterOffersForSeo(offers, parsed).length >= minOffersFor(parsed);
  });
}

// ---------------------------------------------------------------------------
//  Maillage depuis une page d'offre (§33) / un article (§16)
// ---------------------------------------------------------------------------
export interface SeoLandingLink {
  /** Slug complet (ex : « emplois-abidjan »). */
  slug: string;
  /** URL relative (ex : « /emplois-abidjan »). */
  href: string;
  /** Libellé éditorial court (ex : « Offres d'emploi à Abidjan »). */
  label: string;
}

/** Ville SEO correspondant à la localisation d'une offre, ou null. */
export function resolveCity(location?: string | null): CitySeo | null {
  if (!location) return null;
  return CITY_SEO.find((c) => matchesCity(location, c.name)) ?? null;
}

/** Métier SEO correspondant à la colonne `sector`, ou null. */
export function resolveMetier(sector?: string | null): MetierSeo | null {
  if (!sector) return null;
  return METIER_SEO.find((m) => m.sector === sector) ?? null;
}

/**
 * Lien vers la page SEO demandée **si elle existe réellement** (même seuil
 * que le sitemap) — sinon null : on ne crée jamais un lien vers une page
 * qui renverrait un 404.
 */
export function landingForOffer<T extends SeoOfferLike>(
  offers: T[],
  parsed: ParsedJobSeoSlug,
): SeoLandingLink | null {
  if (!parsed.citySlug && !parsed.metierSlug) return null;
  if (filterOffersForSeo(offers, parsed).length < minOffersFor(parsed)) return null;
  const slug = buildJobSeoSlug(parsed);
  return { slug, href: `/${slug}`, label: seoLandingTitle(parsed) };
}

/**
 * Liens SEO complets pour une offre : ville, métier, puis combinaison
 * ville × métier (la plus spécifique est retournée en priorité par l'appelant).
 */
export function landingLinksForOffer<
  T extends SeoOfferLike & { location?: string | null; sector?: string | null },
>(
  offers: T[],
  offer: T,
  activity: JobSeoActivity,
): { city: SeoLandingLink | null; metier: SeoLandingLink | null; combo: SeoLandingLink | null } {
  const city = resolveCity(offer.location);
  const metier = resolveMetier(offer.sector);

  return {
    city: city
      ? landingForOffer(offers, { activity, citySlug: city.slug, metierSlug: null })
      : null,
    metier: metier
      ? landingForOffer(offers, { activity, citySlug: null, metierSlug: metier.slug })
      : null,
    combo:
      city && metier
        ? landingForOffer(offers, { activity, citySlug: city.slug, metierSlug: metier.slug })
        : null,
  };
}

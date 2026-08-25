/**
 *  TravaillerenCi — Service Blog (schéma SQL : blog_posts)
 *  Chemin : src/services/blogService.ts
 *
 *  Couche d'abstraction typée sur la table `blog_posts` :
 *   • Local : via `node:sqlite` (module natif Node 22+, fichier ./data/travaillerenci.sqlite3)
 *   • Prod  : via le SDK Supabase (mêmes signatures, mêmes types BlogPost).
 */

import type {
  BlogPost,
  BlogPostFilters,
  BlogPostInsert,
  BlogPostStatus,
} from '@/types/blog';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { slugify } from '@/lib/slugify';

// -----------------------------------------------------------------------------
// Types SQLite (module natif — mêmes formes que dans jobOfferSchemaService)
// -----------------------------------------------------------------------------
type DatabaseSyncInstance = {
  prepare(sql: string): StatementInstance;
  exec(sql: string): void;
  close(): void;
};
type StatementInstance = {
  run(params?: unknown): { changes: number; lastInsertRowid: unknown };
  get(params?: unknown): any | undefined;
  all(params?: unknown): any[];
};

const DEFAULT_AUTHOR = 'TravaillerenCi';

let cachedDb: DatabaseSyncInstance | null = null;
async function getDb(): Promise<DatabaseSyncInstance | null> {
  if (cachedDb) return cachedDb;
  try {
    const mod = await import('node:sqlite');
    const { DatabaseSync } = mod as unknown as {
      DatabaseSync: new (path: string) => DatabaseSyncInstance;
    };
    const { resolve: resolvePath } = (await import('node:path')) as typeof import('node:path');
    const { existsSync: exists, mkdirSync: mkdir } = (await import('node:fs')) as typeof import('node:fs');
    const dataDir = resolvePath(process.cwd(), 'data');
    if (!exists(dataDir)) mkdir(dataDir, { recursive: true });
    const dbPath = resolvePath(dataDir, 'travaillerenci.sqlite3');
    cachedDb = new DatabaseSync(dbPath);
    ensureSchema(cachedDb);
    return cachedDb;
  } catch (err) {
    console.error('[blogService] SQLite indisponible :', err);
    return null;
  }
}

function ensureSchema(db: DatabaseSyncInstance) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS blog_posts (
      id           TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))),
      title        TEXT NOT NULL,
      slug         TEXT NOT NULL UNIQUE,
      excerpt      TEXT,
      content      TEXT NOT NULL,
      cover_image  TEXT,
      author       TEXT NOT NULL DEFAULT '${DEFAULT_AUTHOR}',
      tags         TEXT,
      status       TEXT NOT NULL DEFAULT 'draft',
      published_at TEXT,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
      CONSTRAINT valid_blog_status CHECK (status IN ('draft','published','archived'))
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_blog_status_published ON blog_posts (status, published_at DESC);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_blog_slug ON blog_posts (slug);`);

  seedDefaultPosts(db);
}

/** Premiers articles d'accueil (insérés une seule fois, uniquement si absents). */
function seedDefaultPosts(db: DatabaseSyncInstance) {
  const posts: Array<{
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    author: string;
    tags: string;
    published_at: string;
  }> = [
    {
      slug: 'bienvenue-sur-le-blog-travaillerenci',
      title: 'Bienvenue sur le blog TravaillerenCi',
      excerpt:
        "Découvrez les coulisses de la plateforme et tout ce que vous devez savoir pour trouver un emploi en Côte d'Ivoire.",
      content:
        "## Bienvenue !\n\n**TravaillerenCi** est la plateforme ivoirienne qui centralise les offres d'emploi, de stages, de bourses et de concours administratifs.\n\nSur ce blog, nous partagerons régulièrement :\n\n- Des conseils pour réussir vos candidatures\n- Les tendances du marché du travail en Côte d'Ivoire\n- Les actualités de la plateforme et les nouvelles fonctionnalités\n- Des témoignages de candidats et de recruteurs\n\n## Comment utiliser la plateforme ?\n\n- **Parcourez** les offres vérifiées sur la page d'accueil\n- **Filtrez** par ville, secteur ou type de contrat\n- **Postulez** en un clic via le lien ou l'email de l'annonce\n- **Créez votre CV** professionnel avec le générateur assisté par IA\n\nBon courage dans vos recherches, et à très vite ! 🇨🇮",
      author: 'AchillesDev10',
      tags: 'plateforme, actualites, bienvenue',
      published_at: new Date().toISOString(),
    },
    {
      slug: 'conseils-candidature-cote-divoire',
      title: "5 conseils pour réussir sa candidature en Côte d'Ivoire",
      excerpt:
        'CV, lettre de motivation, entretien : les bons réflexes pour vous démarquer auprès des recruteurs ivoiriens.',
      content:
        "## Votre candidature mérite mieux qu'un envoi en masse\n\nVoici les conseils que nous donnons le plus souvent aux candidats :\n\n## 1. Adaptez votre CV à chaque offre\n\nUn CV générique est repéré en quelques secondes. Reprenez les **mots-clés de l'annonce** (intitulé du poste, compétences demandées) et mettez en avant vos expériences les plus pertinentes.\n\n## 2. Soignez votre lettre de motivation\n\nAdressez-vous à l'entreprise par son nom, citez une réalisation concrète et expliquez **pourquoi vous** plutôt qu'un autre.\n\n## 3. Vérifiez vos coordonnées\n\nUne simple faute dans votre email ou votre numéro peut vous coûter un entretien. Relisez tout avant d'envoyer.\n\n## 4. Préparez vos références\n\nLes recruteurs ivoiriens apprécient les recommandations vérifiables : prévoyez deux ou trois personnes prêtes à parler de vous.\n\n## 5. Relancez poliment\n\nUne relance courtoise **7 à 10 jours** après l'envoi montre votre motivation et vous démarque des autres candidats.\n\nBon courage, et n'oubliez pas : le générateur de CV de TravaillerenCi est là pour vous aider ! ✨",
      author: 'AchillesDev10',
      tags: 'conseils, cv, candidature',
      published_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    },
    {
      slug: 'secteurs-recrutement-cote-divoire-2025',
      title: "Les secteurs qui recrutent massivement en Côte d'Ivoire en 2025",
      excerpt:
        "IT, BTP, banque, santé… Découvrez les domaines porteurs et les compétences les plus recherchées sur le marché ivoirien.",
      content:
        "## Le marché de l'emploi en pleine expansion\n\nLa Côte d'Ivoire connaît une croissance économique soutenue, et le marché de l'emploi suit le mouvement. Voici les secteurs à surveiller en 2025 :\n\n## 1. IT & Numérique\n\nLe secteur tech continue d'explos à Abidjan. Les entreprises recherchent des développeurs (React, Node.js, Python), des data analysts et des experts en cybersécurité. Les salaires y sont parmi les plus élevés du pays.\n\n## 2. BTP & Génie Civil\n\nAvec les grands projets d'infrastructure (métro d'Abidjan, routes nationales), les ingénieurs civils, conducteurs de travaux et architectes sont très sollicités.\n\n## 3. Banque & Finance\n\nLes banques (NSIA, SGBCI, Ecobank) et les fintechs recrutent en continu : conseillers clients, analystes crédit, responsables conformité.\n\n## 4. Santé\n\nInfirmiers, pharmaciens, médecins généralistes : la demande explose avec l'ouverture de nouvelles cliniques et hôpitaux privés.\n\n## 5. Commerce & Distribution\n\nLes grande surfaces (Casino, Carrefour, Prosuma) et les entreprises de distribution recherchent des commerciaux, responsables logistique et responsables marketing.\n\n## Comment se démarquer ?\n\n- **Formez-vous** aux compétences digitales (même basiques)\n\n- **Obtenez des certifications** reconnues (Google, Microsoft, Cisco)\n\n- **Créez un profil LinkedIn** professionnel\n\n- **Utilisez le générateur CV** de TravaillerenCi pour un CV optimisé",
      author: 'TravaillerenCi',
      tags: 'emploi, recrutement, secteurs, 2025',
      published_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    },
    {
      slug: 'preparer-concours-administratifs-guide',
      title: "Comment préparer un concours administratif en Côte d'Ivoire",
      excerpt:
        "ENA, INFAS, CAFOP, gendarmerie… Voici la méthode complète pour réussir les concours de la fonction publique.",
      content:
        "## Comprendre le système des concours ivoiriens\n\nLes concours administratifs restent le moyen le plus sûr d'accéder à un emploi stable en Côte d'Ivoire. Voici comment bien vous préparer.\n\n## Étape 1 : Identifier le bon concours\n\n- **ENA** : Pour les cadres de la fonction publique (Bac+3 minimum)\n\n- **INFAS** : Pour les infirmiers et agents de santé\n\n- **CAFOP** : Pour les enseignants du secondaire\n\n- **Gendarmerie** : Pour les jeunes de 18 à 24 ans\n\n## Étape 2 : Rassembler les annales\n\nLes annales des sessions précédentes sont votre meilleur outil. Téléchargez-les sur les sites officiels ou demandez-les dans les groupes Telegram de préparation.\n\n## Étape 3 : Constituer un planning\n\n- **3 mois avant** : Révision générale (culture générale, mathématiques, français)\n\n- **2 mois avant** : Exercices pratiques et annales\n\n- **1 mois avant** : Simulation d'examen et gestion du stress\n\n## Étape 4 : Les matières clés\n\n- Culture générale (actualités nationales et internationales)\n\n- Mathématiques / Logique\n\n- Français (orthographe, compréhension)\n\n- Connaissance de l'administration ivoirienne\n\n## Conseils de dernière minute\n\n- Arrivez en avance le jour J\n\n- Apportez tous les documents requis\n\n- Restez calme et lisez bien chaque question\n\n- Ne restez pas bloqué sur une question difficile",
      author: 'TravaillerenCi',
      tags: 'concours, fonction publique, ENA, preparation',
      published_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    },
    {
      slug: 'creer-cv-professionnel-generateur-ia',
      title: "Créer un CV professionnel avec le générateur IA de TravaillerenCi",
      excerpt:
        "Un CV bien conçu double vos chances d'être contacté. Découvrez comment utiliser notre outil gratuit pour un CV percutant.",
      content:
        "## Pourquoi un CV professionnel compte-t-il ?\n\nLes recruteurs passent en moyenne **7 secondes** sur un CV. Un format clair, moderne et adapté au marché ivoirien fait toute la différence.\n\n## Le générateur CV de TravaillerenCi\n\nNotre outil gratuit utilise l'intelligence artificielle pour :\n\n- **Structurer** automatiquement votre parcours\n\n- **Optimiser** vos formulations pour chaque secteur\n\n- **Adapter** le design au format A4 standard\n\n- **Générer** un PDF professionnel en quelques clics\n\n## Étapes d'utilisation\n\n1. Rendez-vous sur la page **Générateur de CV**\n\n2. Remplissez vos informations (expériences, formations, compétences)\n\n3. Ajoutez une photo d'identité professionnelle\n\n4. Téléchargez votre CV en PDF\n\n## Les erreurs à éviter\n\n- **Pas de photo** : En Côte d'Ivoire, la photo est quasi obligatoire\n\n- **CV trop long** : Une page suffit pour la plupart des postes\n\n- **Fautes d'orthographe** : Relisez-vous ou faites relire\n\n- **Informations obsolètes** : Mettez à jour vos coordonnées\n\n## Astuce bonus\n\nAdaptez votre CV pour chaque offre : reprenez les mots-clés de l'annonce dans votre résumé et vos compétences.",
      author: 'TravaillerenCi',
      tags: 'cv, generateur, ia, candidature',
      published_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    },
    {
      slug: 'trouver-stage-abidjan-etudiants',
      title: "Guide complet : trouver un stage à Abidjan en tant qu'étudiant",
      excerpt:
        "Stages rémunérés, conventions, candidatures spontanées… Tout ce qu'il faut savoir pour décrocher votre premier stage.",
      content:
        "## Le stage : tremplin vers l'emploi\n\nEn Côte d'Ivoire, le stage est souvent la première expérience professionnelle. Voici comment maximiser vos chances.\n\n## Où trouver des stages ?\n\n- **Plateformes en ligne** : TravaillerEnCi, Envie d'Emploi, LinkedIn\n\n- **Sites des entreprises** : Orange, MTN, NSIA, Ecobank\n\n- **Candidatures spontanées** : Envoyez votre CV par email aux RH\n\n- **Forum de l'emploi** : Les universités organisent régulièrement des événements\n\n## Les documents indispensables\n\n- CV à jour (utilisez le générateur TravaillerenCi)\n\n- Lettre de motivation personnalisée\n\n- Relevé de notes\n\n- Convention de stage (si demandée)\n\n## Conseils pour la candidature\n\n- **Personnalisez** chaque lettre de motivation\n\n- **Mettez en avant** vos projets universitaires et compétences techniques\n\n- **Soyez proactif** : ne vous contentez pas des offres publiées\n\n- **Relancez** après 10 jours sans réponse\n\n## Stage rémunéré vs non rémunéré\n\nLes stages de plus de 3 mois en entreprise doivent être rémunérés according to la législation ivoirienne. N'hésitez pas à négocier.",
      author: 'TravaillerenCi',
      tags: 'stage, etudiants, abidjan, candidature',
      published_at: new Date(Date.now() - 10 * 86400000).toISOString(),
    },
    {
      slug: 'bourses-etudes-etranger-ivoiriens',
      title: "Les meilleures bourses d'études à l'étranger pour les Ivoiriens en 2025",
      excerpt:
        "Chevening, Erasmus Mundus, bourses chinoises, sud-coréennes… Découvrez les opportunités de financement pour étudier à l'étranger.",
      content:
        "## Étudier à l'étranger : un rêve accessible\n\nDe nombreuses bourses sont disponibles pour les étudiants ivoiriens. Voici les principales opportunités de 2025.\n\n## Les bourses les plus prestigieuses\n\n### Chevening (Royaume-Uni)\n\n- Pour les jeunes leaders de moins de 26 ans\n\n- Master entièrement financé\n\n- Candidatures ouvertes d'août à novembre\n\n### Erasmus Mundus (Union Européenne)\n\n- Master conjoint dans plusieurs pays européens\n\n- Bourse de 1 400 €/mois + frais d'inscription\n\n- Candidatures de septembre à janvier\n\n### Bourses chinoises (CSC)\n\n- Licence, master ou doctorat en Chine\n\n- Frais de scolarité, logement et allocation mensuelle\n\n- Candidatures de janvier à avril\n\n### Bourses coréennes (KGSP)\n\n- Master ou doctorat en Corée du Sud\n\n- Formation en coréien incluse\n\n- Candidatures de février à mars\n\n## Comment postuler efficacement ?\n\n1. **Commencez tôt** : certaines bourses ont des délais stricts\n\n2. **Préparez un dossier solide** : notes, lettres de recommandation, projet professionnel\n\n3. **Écrivez un excellent essai** : montrez votre motivation et votre projet\n\n4. **Préparez-vous aux entretiens** : entraînez-vous en anglais ou dans la langue cible\n\n## Ressources utiles\n\n- Consultez régulièrement la section Bourses de TravaillerenCi\n\n- Rejoignez les groupes Telegram de bourses pour les Ivoiriens\n\n- Suivez les ambassades et instituts culturels sur les réseaux sociaux",
      author: 'TravaillerenCi',
      tags: 'bourses, etudes, etranger, chevening, erasmus',
      published_at: new Date(Date.now() - 14 * 86400000).toISOString(),
    },
    {
      slug: 'entretien-embauche-reussir-cote-divoire',
      title: "Comment réussir son entretien d'embauche en Côte d'Ivoire",
      excerpt:
        "Préparation, tenue vestimentaire, questions classiques… Les clés pour convaincre lors de votre prochain entretien.",
      content:
        "## Avant l'entretien\n\n### Recherchez l'entreprise\n\n- Consultez le site web, les réseaux sociaux et les actualités récentes\n\n- Comprenez les produits/services, la culture et les valeurs\n\n- Identifiez les défis actuels de l'entreprise\n\n### Préparez vos réponses\n\nLes questions les plus fréquentes en Côte d'Ivoire :\n\n- « Parlez-moi de vous » → Résumé en 2 minutes de votre parcours\n\n- « Pourquoi cette entreprise ? » → Montrez que vous avez fait vos recherches\n\n- « Quelles sont vos qualités/défauts ? » → Soyez honnête et concret\n\n- « Où vous voyez-vous dans 5 ans ? » → Montrez votre ambition réaliste\n\n## Le jour J\n\n### Tenue vestimentaire\n\n- Costume sombre pour les hommes, tailleure pour les femmes\n\n- Chaussures propre et soignées\n\n- Accessoires discrets (montre, bijoux simples)\n\n- Parfum léger, pas de cigarette\n\n### Ponctualité\n\n- Arrivez **10 à 15 minutes en avance**\n\n- Prévoyez le trajet à l'avance (trafic d'Abidjan !)\n\n- Ayez les numéros de téléphone de l'entreprise\n\n### Communication\n\n- Serrez la main fermement\n\n- Maintenez un contact visuel\n\n- Écoutez avant de répondre\n\n- Soyez clair et concis\n\n## Après l'entretien\n\n- Envoyez un **email de remerciement** dans les 24h\n\n- Relancez poliment après **7 à 10 jours**\n\n- Continuez à postuler ailleurs en attendant",
      author: 'TravaillerenCi',
      tags: 'entretien, embauche, recrutement, conseils',
      published_at: new Date(Date.now() - 18 * 86400000).toISOString(),
    },
    {
      slug: 'metiers-numeriques-cote-divoire',
      title: "Les métiers du numérique les mieux payés en Côte d'Ivoire",
      excerpt:
        "Développeur web, data analyst, UX designer… Découvrez les postes tech qui offrent les meilleurs salaires à Abidjan.",
      content:
        "## Le boom du numérique à Abidjan\n\nAvec l'arrivée de hubs technologiques et de startups, les métiers du numérique sont devenus les mieux payés du pays. Voici un panorama.\n\n## Top 5 des métiers les mieux rémunérés\n\n### 1. Développeur Full-Stack\n\n- **Salaire** : 800 000 à 2 500 000 FCFA/mois\n\n- **Stack** : React/Next.js, Node.js, Python\n\n- **Demande** : Très forte (startups + entreprises établies)\n\n### 2. Data Analyst / Data Scientist\n\n- **Salaire** : 700 000 à 2 000 000 FCFA/mois\n\n- **Outils** : Python, SQL, Power BI, Excel avancé\n\n- **Secteurs** : Banque, télécom, agroalimentaire\n\n### 3. Chef de Projet IT\n\n- **Salaire** : 900 000 à 2 200 000 FCFA/mois\n\n- **Compétences** : Gestion de projet, Agile/Scrum, communication\n\n- **Expérience** : 3-5 ans minimum\n\n### 4. UX/UI Designer\n\n- **Salaire** : 600 000 à 1 800 000 FCFA/mois\n\n- **Outils** : Figma, Adobe XD, principes de design\n\n- **Atout** : Portfolio en ligne\n\n### 5. Expert en Cybersécurité\n\n- **Salaire** : 1 000 000 à 3 000 000 FCFA/mois\n\n- **Certifications** : CISSP, CEH, CompTIA Security+\n\n- **Domaine** : Banques, entreprises critiques\n\n## Comment se former ?\n\n- **Plateformes gratuites** : FreeCodeCamp, The Odin Project, Khan Academy\n\n- **Certifications** : Google Digital Garage, IBM SkillsBuild\n\n- **Communautés** : GDG Abidjan, Facebook Developer Circles\n\n- **Projets personnels** : Créez un portfolio GitHub solide",
      author: 'TravaillerenCi',
      tags: 'numerique, tech, salaires, developpeur, data',
      published_at: new Date(Date.now() - 21 * 86400000).toISOString(),
    },
    {
      slug: 'lettres-motivation-exemples-cote-divoire',
      title: "Exemples de lettres de motivation efficaces pour le marché ivoirien",
      excerpt:
        "Modèles concrets et conseils pour rédiger une lettre de motivation qui retient l'attention des recruteurs en Côte d'Ivoire.",
      content:
        "## La lettre de motivation : votre arme secrète\n\nEn Côte d'Ivoire, la lettre de motivation reste un élément clé du dossier de candidature. Voici comment la rédiger efficacement.\n\n## Structure idéale\n\n### Paragraph 1 : L'accroche\n\nCommencez par mentionner le poste visé et une réalisation concrète :\n\n> « Candidature au poste de Chef Comptable chez NSIA Banque. Fort de 5 années d'expérience en audit financier chez PwC Abidjan, je souhaite mettre mon expertise au service de votre croissance. »\n\n### Paragraph 2 : Votre parcours\n\nMettez en avant 2-3 compétences clés en lien avec le poste :\n\n> « Au cours de mes expériences précédentes, j'ai piloté des audits pour des clients du secteur bancaire et minier, réduisant les anomalies comptables de 35%. Ma maîtrise des normes OHADA et mon aisance relationnelle me permettent de collaborer efficacement avec les équipes métiers. »\n\n### Paragraph 3 : Votre motivation\n\nExpliquez pourquoi cette entreprise en particulier :\n\n> « NSIA Banque se distingue par son innovation digitale et son engagement envers la金融 inclusive. Je suis convaincu que mon expérience en transformation numérique des processus comptables peut contribuer à vos projets d'avenir. »\n\n## Les erreurs fatales\n\n- **Lettre générique** : « Je suis à la recherche d'un emploi » → Trop vague\n\n- **Répéter le CV** : La lettre apporte du contexte, pas des listes\n\n- **Trop long** : Une page maximum\n\n- **Fautes** : Trois fautes = élimination quasi certaine\n\n## Conseil final\n\nUtilisez le ton formel mais pas froid. Montrez votre personnalité tout en restant professionnel.",
      author: 'TravaillerenCi',
      tags: 'lettre motivation, candidature, conseils, emploi',
      published_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    },
    {
      slug: 'negocier-salaire-cote-divoire',
      title: "Comment négocier son salaire en Côte d'Ivoire sans perdre l'offre",
      excerpt:
        "Stratégies, fourchettes de salaires par secteur et erreurs à éviter pour décrocher la rémunération que vous méritez.",
      content:
        "## La négociation salariale : un tabou à lever\n\nBeaucoup de candidats ivoiriens n'osent pas négocier leur salaire. Pourtant, c'est une étape normale du processus de recrutement.\n\n## Quand négocier ?\n\n- **Après** avoir reçu une offre écrite\n\n- **Jamais** lors du premier entretien\n\n- **Toujours** avant de signer le contrat\n\n## Les fourchettes de salaires (Abidjan, 2025)\n\n| Secteur | Junior (0-2 ans) | Confirmé (3-5 ans) | Senior (5+ ans) |\n|---|---|---|---|\n| IT / Digital | 500K - 1M | 1M - 2M | 2M - 4M |\n| Banque | 400K - 800K | 800K - 1.5M | 1.5M - 3M |\n| BTP | 350K - 700K | 700K - 1.2M | 1.2M - 2.5M |\n| Commerce | 300K - 600K | 600K - 1M | 1M - 2M |\n\n*(en FCFA/mois)*\n\n## Les stratégies qui fonctionnent\n\n1. **Renseignez-vous** sur les grilles salariales du secteur\n\n2. **Justifiez** votre demande avec vos compétences et expériences\n\n3. **Proposez une fourchette** plutôt qu'un chiffre fixe\n\n4. **Négociez les avantages** si le salaire est bloqué (formation, télétravail, primes)\n\n5. **Restez positif** : c'est une discussion, pas un conflit\n\n## Les erreurs à éviter\n\n- **Révéler votre salaire actuel** : non obligatoire et souvent défavorable\n\n- **Accepter immédiatement** : prenez 24-48h pour réfléchir\n\n- **Mentir** sur une autre offre : vérifiable et destructeur pour la confiance\n\n- **Négocier par email** : préférez le téléphone ou le face-à-face",
      author: 'TravaillerenCi',
      tags: 'salaire, negotiation, emploi, carriere',
      published_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    },
  ];

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO blog_posts (title, slug, excerpt, content, cover_image, author, tags, status, published_at, created_at, updated_at)
     VALUES ($title, $slug, $excerpt, $content, NULL, $author, $tags, 'published', $published_at, $published_at, $published_at)`
  );
  for (const p of posts) {
    stmt.run({
      $title: p.title,
      $slug: p.slug,
      $excerpt: p.excerpt,
      $content: p.content,
      $author: p.author,
      $tags: p.tags,
      $published_at: p.published_at,
    });
  }
}

function rowToPost(row: any): BlogPost {
  return {
    ...row,
    excerpt: row.excerpt ?? null,
    cover_image: row.cover_image ?? null,
    tags: row.tags ?? null,
    published_at: row.published_at ?? null,
    status: row.status || 'draft',
  };
}

function normalizePostFromSupabase(row: any): BlogPost {
  return {
    id: String(row.id),
    title: String(row.title || ''),
    slug: String(row.slug || ''),
    excerpt: row.excerpt ?? null,
    content: String(row.content || ''),
    cover_image: row.cover_image ?? null,
    author: String(row.author || DEFAULT_AUTHOR),
    tags: row.tags ?? null,
    status: (['draft', 'published', 'archived'].includes(row.status) ? row.status : 'draft') as BlogPostStatus,
    published_at: row.published_at ?? null,
    created_at: row.created_at ?? new Date().toISOString(),
    updated_at: row.updated_at ?? new Date().toISOString(),
  };
}

/** Colonnes autorisées pour les mises à jour (protection contre les injections SQL). */
const UPDATE_COLUMNS = new Set([
  'title',
  'slug',
  'excerpt',
  'content',
  'cover_image',
  'author',
  'tags',
  'status',
  'published_at',
]);

function buildFiltersSql(filters: BlogPostFilters) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  if (filters.status) {
    const list = Array.isArray(filters.status) ? filters.status : [filters.status];
    const placeholders = list.map((_, i) => `$st${i}`).join(',');
    list.forEach((t, i) => (params[`$st${i}`] = t));
    clauses.push(`status IN (${placeholders})`);
  }
  if (filters.keyword) {
    clauses.push('(title LIKE $kw OR excerpt LIKE $kw OR content LIKE $kw OR tags LIKE $kw)');
    params.$kw = `%${filters.keyword}%`;
  }
  return { whereSql: clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '', params };
}

export class BlogService {
  static async list(filters: BlogPostFilters = {}): Promise<{ rows: BlogPost[]; total: number }> {
    if (isSupabaseConfigured()) return this.listSupabase(filters);

    const db = await getDb();
    if (!db) return { rows: [], total: 0 };

    const { whereSql, params } = buildFiltersSql(filters);
    const orderBy = (['created_at', 'published_at', 'title'] as const).includes(
      (filters.order_by || 'created_at') as 'created_at' | 'published_at' | 'title'
    )
      ? filters.order_by!
      : 'created_at';
    const dir = filters.order_dir === 'asc' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(filters.limit || 50, 1), 200);
    const offset = Math.max(filters.offset || 0, 0);

    const rows = db
      .prepare(
        `SELECT * FROM blog_posts ${whereSql} ORDER BY ${orderBy} ${dir} LIMIT $limit OFFSET $offset`
      )
      .all({ ...params, $limit: limit, $offset: offset })
      .map(rowToPost);
    const total = (
      db.prepare(`SELECT COUNT(*) AS total FROM blog_posts ${whereSql}`).get(params) as any
    ).total;
    return { rows, total };
  }

  static async getById(id: string): Promise<BlogPost | null> {
    if (isSupabaseConfigured()) return this.getByIdSupabase(id);
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM blog_posts WHERE id = $id').get({ $id: id });
    return row ? rowToPost(row) : null;
  }

  static async getBySlug(slug: string): Promise<BlogPost | null> {
    if (isSupabaseConfigured()) return this.getBySlugSupabase(slug);
    const db = await getDb();
    if (!db) return null;
    const row = db.prepare('SELECT * FROM blog_posts WHERE slug = $slug').get({ $slug: slug });
    return row ? rowToPost(row) : null;
  }

  /** Slug unique : si le slug demandé est pris, on suffixe -2, -3… (exclut l'id donné en édition). */
  static async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    const base = slugify(slug) || 'article';
    let candidate = base;
    let i = 2;
    while (await this.slugExists(candidate, excludeId)) {
      candidate = `${base}-${i++}`;
    }
    return candidate;
  }

  private static async slugExists(slug: string, excludeId?: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      if (!supabase) return false;
      let query = supabase.from('blog_posts').select('id').eq('slug', slug);
      if (excludeId) query = query.neq('id', excludeId);
      const { data } = await query.limit(1);
      return Boolean(data && data.length > 0);
    }
    const db = await getDb();
    if (!db) return false;
    const row = db
      .prepare(
        excludeId
          ? 'SELECT id FROM blog_posts WHERE slug = $slug AND id != $id LIMIT 1'
          : 'SELECT id FROM blog_posts WHERE slug = $slug LIMIT 1'
      )
      .get(excludeId ? { $slug: slug, $id: excludeId } : { $slug: slug });
    return Boolean(row);
  }

  static async create(data: Partial<BlogPostInsert>): Promise<BlogPost | null> {
    if (isSupabaseConfigured()) return this.createSupabase(data);

    const db = await getDb();
    if (!db) return null;

    const title = String(data.title || '').trim();
    if (!title) return null;

    const status = (['draft', 'published', 'archived'].includes(data.status as string)
      ? data.status
      : 'draft') as BlogPostStatus;
    const now = new Date().toISOString();
    const slug = await this.ensureUniqueSlug(data.slug || title);

    const res = db
      .prepare(
        `INSERT INTO blog_posts (title, slug, excerpt, content, cover_image, author, tags, status, published_at, created_at, updated_at)
         VALUES ($title, $slug, $excerpt, $content, $cover_image, $author, $tags, $status, $published_at, datetime('now'), datetime('now'))
         RETURNING id`
      )
      .get({
        $title: title,
        $slug: slug,
        $excerpt: data.excerpt ? String(data.excerpt).trim() || null : null,
        $content: String(data.content || '').trim(),
        $cover_image: data.cover_image ? String(data.cover_image).trim() || null : null,
        $author: String(data.author || DEFAULT_AUTHOR).trim() || DEFAULT_AUTHOR,
        $tags: data.tags ? String(data.tags).trim() || null : null,
        $status: status,
        $published_at:
          status === 'published' && data.published_at
            ? String(data.published_at).trim() || now
            : status === 'published'
            ? now
            : data.published_at
            ? String(data.published_at).trim() || null
            : null,
      }) as any;

    return res?.id ? this.getById(res.id) : null;
  }

  static async update(id: string, patch: Partial<BlogPostInsert>): Promise<BlogPost | null> {
    if (isSupabaseConfigured()) return this.updateSupabase(id, patch);

    const db = await getDb();
    if (!db) return null;
    const existing = await this.getById(id);
    if (!existing) return null;

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!UPDATE_COLUMNS.has(key)) continue;
      if (typeof value === 'string') {
        clean[key] = value.trim();
      } else if (value === null) {
        clean[key] = null;
      }
    }

    if (typeof clean.slug === 'string' && clean.slug.trim()) {
      clean.slug = await this.ensureUniqueSlug(clean.slug, id);
    } else {
      // Slug vide → on conserve le slug existant.
      delete clean.slug;
    }

    // Publication sans date : on horodate automatiquement (l'ordre du blog
    // public dépend de published_at).
    if (clean.status === 'published' && !existing.published_at) {
      clean.published_at = new Date().toISOString();
    }

    if (Object.keys(clean).length === 0) return existing;

    const fields = Object.keys(clean).map((k) => `${k} = $${k}`).join(', ');
    const params: Record<string, unknown> = { $id: id };
    Object.entries(clean).forEach(([k, v]) => (params[`$${k}`] = v));
    db.prepare(`UPDATE blog_posts SET ${fields}, updated_at = datetime('now') WHERE id = $id`).run(params);
    return this.getById(id);
  }

  static async remove(id: string): Promise<boolean> {
    if (isSupabaseConfigured()) return this.removeSupabase(id);
    const db = await getDb();
    if (!db) return false;
    return (db.prepare('DELETE FROM blog_posts WHERE id = $id').run({ $id: id }).changes || 0) > 0;
  }

  // ===========================================================================
  //  Implémentations Supabase (production)
  // ===========================================================================

  private static async listSupabase(filters: BlogPostFilters): Promise<{ rows: BlogPost[]; total: number }> {
    const supabase = getSupabaseClient();
    if (!supabase) return { rows: [], total: 0 };

    let query = supabase.from('blog_posts').select('*', { count: 'exact' });
    if (filters.status) {
      const list = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (list.length > 0) query = query.in('status', list);
    }
    if (filters.keyword) {
      const safeKeyword = String(filters.keyword).replace(/[,.( )*!]/g, ' ').trim();
      if (safeKeyword) {
        const pattern = `%${safeKeyword}%`;
        query = query.or(`title.ilike.${pattern},excerpt.ilike.${pattern},content.ilike.${pattern},tags.ilike.${pattern}`);
      }
    }
    const orderBy = (['created_at', 'published_at', 'title'] as const).includes(
      (filters.order_by || 'created_at') as 'created_at' | 'published_at' | 'title'
    )
      ? filters.order_by!
      : 'created_at';
    query = query.order(orderBy, { ascending: filters.order_dir === 'asc' });
    const safeLimit = Math.min(Math.max(filters.limit || 50, 1), 200);
    query = query.range(filters.offset || 0, (filters.offset || 0) + safeLimit - 1);

    const { data, count, error } = await query;
    if (error) {
      console.error('listSupabase (blog) error:', error.message);
      return { rows: [], total: 0 };
    }
    return { rows: (data || []).map(normalizePostFromSupabase), total: count || 0 };
  }

  private static async getByIdSupabase(id: string): Promise<BlogPost | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !data) return null;
    return normalizePostFromSupabase(data);
  }

  private static async getBySlugSupabase(slug: string): Promise<BlogPost | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error || !data) return null;
    return normalizePostFromSupabase(data);
  }

  private static async createSupabase(data: Partial<BlogPostInsert>): Promise<BlogPost | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;

    const title = String(data.title || '').trim();
    if (!title) return null;

    const status = (['draft', 'published', 'archived'].includes(data.status as string)
      ? data.status
      : 'draft') as BlogPostStatus;
    const now = new Date().toISOString();
    const slug = await this.ensureUniqueSlug(data.slug || title);

    const payload = {
      title,
      slug,
      excerpt: data.excerpt ? String(data.excerpt).trim() || null : null,
      content: String(data.content || '').trim(),
      cover_image: data.cover_image ? String(data.cover_image).trim() || null : null,
      author: String(data.author || DEFAULT_AUTHOR).trim() || DEFAULT_AUTHOR,
      tags: data.tags ? String(data.tags).trim() || null : null,
      status,
      published_at:
        status === 'published' && data.published_at
          ? String(data.published_at).trim() || now
          : status === 'published'
          ? now
          : data.published_at
          ? String(data.published_at).trim() || null
          : null,
    };

    const { data: created, error } = await supabase
      .from('blog_posts')
      .insert(payload)
      .select()
      .maybeSingle();
    if (error || !created) {
      console.error('createSupabase (blog) error:', error?.message);
      return null;
    }
    return normalizePostFromSupabase(created);
  }

  private static async updateSupabase(id: string, patch: Partial<BlogPostInsert>): Promise<BlogPost | null> {
    const supabase = getSupabaseClient();
    if (!supabase) return null;
    const existing = await this.getByIdSupabase(id);
    if (!existing) return null;

    const clean: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (!UPDATE_COLUMNS.has(key)) continue;
      clean[key] = typeof value === 'string' ? value.trim() : value;
    }
    if (typeof clean.slug === 'string' && clean.slug.trim()) {
      clean.slug = await this.ensureUniqueSlug(clean.slug, id);
    } else {
      // Slug vide → on conserve le slug existant.
      delete clean.slug;
    }

    // Publication sans date : on horodate automatiquement.
    if (clean.status === 'published' && !existing.published_at) {
      clean.published_at = new Date().toISOString();
    }

    if (Object.keys(clean).length === 0) return existing;

    const { data, error } = await supabase
      .from('blog_posts')
      .update({ ...clean, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error || !data) {
      console.error('updateSupabase (blog) error:', error?.message);
      return null;
    }
    return normalizePostFromSupabase(data);
  }

  private static async removeSupabase(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    if (!supabase) return false;
    const { data, error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id)
      .select('id');
    return !error && Array.isArray(data) && data.length > 0;
  }
}

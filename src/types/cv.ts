export interface Experience {
  id: string;
  company: string;
  position: string;
  period: string;
  description: string;
}

export interface Education {
  id: string;
  school: string;
  degree: string;
  year: string;
}

export interface CVData {
  fullName: string;
  jobTitle: string;
  email: string;
  phone: string;
  city: string;
  summary: string;
  experiences: Experience[];
  educations: Education[];
  skills: string[];
}

export const createEmptyCV = (): CVData => ({
  fullName: '',
  jobTitle: '',
  email: '',
  phone: '',
  city: '',
  summary: '',
  experiences: [],
  educations: [],
  skills: [],
});

export const createSampleCV = (): CVData => ({
  fullName: 'KONÉ Awa',
  jobTitle: 'Assistante de Direction',
  email: 'awa.kone@email.ci',
  phone: '+225 07 12 34 56 78',
  city: 'Abidjan, Cocody',
  summary:
    "Assistante de direction organisée et proactive, avec 5 ans d'expérience dans la gestion administrative, l'accueil et la coordination d'agenda. Reconnue pour ma rigueur, ma discrétion et ma capacité à gérer plusieurs priorités dans un environnement exigeant. Je recherche un poste où mettre à profit mon sens du service et mon aisance relationnelle.",
  experiences: [
    {
      id: 'sample-exp-1',
      position: 'Assistante de Direction',
      company: "Groupe CFAO Côte d'Ivoire",
      period: 'Janv. 2022 - Aujourd\u2019hui',
      description:
        "Gérer l'agenda de la direction et organiser les réunions internes et externes.\nPréparer les supports de présentation, les comptes rendus et le suivi des dossiers.\nCoordonner les déplacements et les demandes des différents services.",
    },
    {
      id: 'sample-exp-2',
      position: "Chargée d'accueil et d'administration",
      company: 'Cabinet EXCO CI',
      period: 'Sept. 2019 - Déc. 2021',
      description:
        "Accueillir les clients et assurer la gestion du standard téléphonique.\nTraiter le courrier, les factures et les relances administratives.\nTenir à jour les tableaux de suivi et les dossiers du personnel.",
    },
  ],
  educations: [
    {
      id: 'sample-edu-1',
      degree: 'Licence en Gestion des Entreprises',
      school: 'Université Félix Houphouët-Boigny',
      year: '2016 - 2019',
    },
    {
      id: 'sample-edu-2',
      degree: 'BTS Assistant de Direction',
      school: 'Institut National Polytechnique Félix Houphouët-Boigny',
      year: '2014 - 2016',
    },
  ],
  skills: [
    'Gestion administrative',
    'Microsoft Office 365',
    'Communication professionnelle',
    'Organisation & planification',
    'Accueil & relation client',
    'Rédaction professionnelle',
    'Facturation',
    "Gestion d'agenda",
  ],
});

export const createEmptyExperience = (): Experience => ({
  id: crypto.randomUUID(),
  company: '',
  position: '',
  period: '',
  description: '',
});

export const createEmptyEducation = (): Education => ({
  id: crypto.randomUUID(),
  school: '',
  degree: '',
  year: '',
});

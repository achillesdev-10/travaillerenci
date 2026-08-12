/**
 *  TravaillerEnCi — Assistant : réponses prédéfinies (FAQ)
 *  Chemin : src/services/assistant/faqService.ts
 *
 *  Réponses statiques aux questions fréquentes. Les liens pointent vers les
 *  vraies pages du site. Aucune donnée inventée (pas de numéro de téléphone
 *  fictif : on renvoie vers le canal WhatsApp et l'email réellement configurés).
 */

import { SITE_CONFIG } from '@/lib/constants';
import type { AssistantReply } from './types';

interface FaqEntry {
  reply: Omit<AssistantReply, 'aiUsed'>;
}

const FAQ_ENTRIES: Record<string, FaqEntry> = {
  create_account: {
    reply: {
      text: [
        "Créer un compte sur TravaillerenCi est gratuit et rapide :",
        "1. Rendez-vous sur la page d'inscription (2 minutes environ) ;",
        "2. Choisissez votre profil : Candidat (recherche d'emploi, de stage, de bourse ou de concours) ou Entreprise (publication d'offres) ;",
        "3. Renseignez vos informations et validez : votre compte est utilisable immédiatement.",
        "",
        "Une fois connecté, vous pourrez sauvegarder des offres, configurer des alertes personnalisées et compléter votre profil (CV, secteurs d'intérêt, ville).",
      ].join('\n'),
      results: [],
      seeMoreUrl: '/register',
    },
  },
  create_cv: {
    reply: {
      text: [
        "Vous pouvez créer votre CV gratuitement avec notre générateur de CV IA.",
        "",
        "Il vous guide pas à pas (expérience, formation, compétences) et produit un CV professionnel prêt à télécharger.",
        "",
        "Cliquez sur « Créer mon CV » pour commencer :",
      ].join('\n'),
      results: [],
      seeMoreUrl: '/generateur-de-cv',
    },
  },
  categories: {
    reply: {
      text: [
        "TravaillerenCi regroupe 4 types de contenus, tous issus de sources vérifiées :",
        "",
        "• 💼 Emplois : CDI, CDD, contrats et missions des entreprises en Côte d'Ivoire ;",
        "• 🎓 Concours : concours administratifs et de la fonction publique (ENA, INFS, etc.) ;",
        "• 📚 Bourses : bourses d'études en Côte d'Ivoire et à l'international ;",
        "• 💻 Stages : stages professionnels et de fin d'études.",
        "",
        "Vous pouvez les parcourir depuis le menu du site ou me demander directement : « je cherche un emploi en informatique à Abidjan », « quels concours sont disponibles ? », etc.",
      ].join('\n'),
      results: [],
    },
  },
  contact: {
    reply: {
      text: [
        "Vous pouvez contacter l'équipe TravaillerenCi :",
        `• 📧 Par email : ${SITE_CONFIG.supportEmail}`,
        `• 💬 Via notre canal WhatsApp (liens dans le pied de page et sur la page Contact)`,
        "• 📘 Facebook / LinkedIn / TikTok (page Contact)",
        "",
        "Pour un problème sur une offre, utilisez le bouton « Signaler » présent sur chaque fiche : l'équipe de modération traite chaque signalement.",
      ].join('\n'),
      results: [],
      seeMoreUrl: '/contact',
    },
  },
  how_to_use: {
    reply: {
      text: [
        "Voici comment utiliser TravaillerenCi :",
        "1. 💼 Offres d'emploi : parcourez /jobs, filtrez par ville, contrat ou mot-clé ;",
        "2. 🎓 Concours : consultez /concours pour les concours administratifs (ouvert/à venir/clos) ;",
        "3. 📚 Bourses : explorez /bourses pour les bourses d'études ;",
        "4. 📄 CV : créez votre CV avec le générateur IA sur /generateur-de-cv ;",
        "5. 👤 Compte : créez un compte pour sauvegarder des offres et activer des alertes.",
        "",
        "Besoin d'aide sur un point précis ? Posez-moi votre question !",
      ].join('\n'),
      results: [],
    },
  },
  apply_how: {
    reply: {
      text: [
        "Pour postuler, c'est très simple :",
        "1. Ouvrez la fiche de l'offre, du concours ou de la bourse qui vous intéresse ;",
        "2. Utilisez le bouton « Postuler » : il ouvre soit le lien de candidature de l'entreprise, soit un email pré-rempli ;",
        "3. Pour les concours, suivez les instructions officielles indiquées sur la fiche (retrait des dossiers, dépôt du dossier, dates limites).",
        "",
        "⚠️ Rappel : candidater à une offre ou à une bourse est TOUJOURS gratuit. Si un organisme réclame de l'argent, méfiez-vous et signalez-le.",
      ].join('\n'),
      results: [],
    },
  },
};

/** Retourne la réponse FAQ, ou null si la clé est inconnue. */
export function getFaqReply(faqKey: string): AssistantReply | null {
  const entry = FAQ_ENTRIES[faqKey];
  if (!entry) return null;
  return { ...entry.reply, aiUsed: false };
}

/** Liste des clés FAQ connues (utile pour les tests). */
export function listFaqKeys(): string[] {
  return Object.keys(FAQ_ENTRIES);
}

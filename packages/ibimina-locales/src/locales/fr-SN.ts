/**
 * French (Senegal) Content Pack
 */

import type { CountryContentPack, TranslationMessages } from "../types/index.js";

export const frSNContentPack: CountryContentPack = {
  locale: "fr-SN",
  countryISO3: "SEN",
  countryName: "Sénégal",

  ussd: {
    providers: [
      {
        name: "Orange Money",
        telco: "orange",
        code: "#144#",
        instructions: [
          "Composez #144#",
          "Choisissez 'Paiement marchand'",
          "Saisissez le code marchand",
          "Entrez la référence fournie",
          "Indiquez le montant",
          "Validez avec votre code secret",
        ],
        variants: [
          {
            telco: "orange-kiosk",
            code: "#144*391#",
            instructions: [
              "Composez #144*391#",
              "Sélectionnez 'SACCO+'",
              "Entrez l'identifiant membre",
              "Confirmez le montant",
            ],
          },
        ],
      },
      {
        name: "Free Money",
        telco: "free",
        code: "*150#",
        instructions: [
          "Composez *150#",
          "Choisissez 'Paiement'",
          "Saisissez le code marchand",
          "Saisissez la référence",
          "Validez le montant",
          "Confirmez avec le code secret",
        ],
      },
    ],
    generalInstructions: [
      "Utilisez le numéro de référence tel qu'indiqué sur votre carte",
      "Vérifiez le montant avant de confirmer",
      "Conservez le SMS de confirmation",
    ],
    fallbackMessage: "En cas d'échec, composez #144# ou contactez le support au +221 33 000 00 00.",
  },

  legal: {
    termsUrl: "/legal/terms?lang=fr",
    privacyUrl: "/legal/privacy?lang=fr",
  },

  help: {
    paymentGuide: [
      "Assurez-vous d'avoir suffisamment de solde",
      "Utilisez exactement la référence fournie",
      "Contactez votre mutuelle si besoin",
    ],
    troubleshooting: [
      "Si le code échoue : réessayez d'un autre téléphone",
      "Si le paiement est rejeté : vérifiez la référence",
      "Pas de SMS : composez #144# pour consulter l'historique",
    ],
    contactInfo: {
      helpline: "+221 33 000 00 00",
      email: "assistance@sacco-plus.sn",
      hours: "Lundi - Vendredi, 9h00 - 17h00",
    },
  },

  tips: {
    dualSim: [
      "Utilisez la SIM liée au compte mobile money",
      "Activez les données mobiles pour accélérer la synchronisation",
    ],
    networkIssues: [
      "Déplacez-vous vers une zone avec une meilleure couverture",
      "Patientez quelques minutes avant de réessayer",
    ],
    marketDays: ["Jour de marché : samedi - payez avant midi"],
    contactless: [
      "Approchez votre carte SACCO+ des terminaux NFC partenaires",
      "Gardez la carte immobile jusqu'au bip sonore",
    ],
  },
};

export const frSNMessages: TranslationMessages = {
  common: {
    welcome: "Bienvenue",
    save: "Enregistrer",
    cancel: "Annuler",
    delete: "Supprimer",
    edit: "Modifier",
    loading: "Chargement...",
    error: "Erreur",
    success: "Succès",
  },

  payment: {
    title: "Paiement",
    amount: "Montant",
    reference: "Référence",
    confirmPayment: "Confirmer le paiement",
    paymentSuccess: "Paiement réussi",
    paymentFailed: "Paiement échoué",
  },

  member: {
    title: "Membre",
    name: "Nom",
    phone: "Téléphone",
    memberCode: "Numéro de membre",
    joinDate: "Date d'adhésion",
  },

  group: {
    title: "Groupe",
    groupName: "Nom du groupe",
    groupCode: "Code du groupe",
    members: "Membres",
    totalSavings: "Épargne totale",
  },

  accessibility: {
    motionToggleLabel: "Activer la réduction des animations",
    talkbackHint: "Tapez une fois pour entendre, deux fois pour ouvrir.",
    voiceoverHint: "Balayez vers la droite pour lire chaque instruction.",
  },

  offers: {
    title: "Offres",
    description: "Découvrez les prêts et services négociés par votre mutuelle.",
    cta: "Voir les offres",
    upcoming: "De nouvelles offres apparaîtront automatiquement lorsqu'elles seront actives.",
  },
};

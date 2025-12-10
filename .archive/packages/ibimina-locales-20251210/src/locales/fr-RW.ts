/**
 * French (Rwanda) Content Pack
 */

import type { CountryContentPack, TranslationMessages } from "../types/index.js";

export const frRWContentPack: CountryContentPack = {
  locale: "fr-RW",
  countryISO3: "RWA",
  countryName: "Rwanda",

  ussd: {
    providers: [
      {
        name: "MTN Mobile Money",
        telco: "mtn",
        code: "*182*8*1#",
        instructions: [
          "Composez *182*8*1#",
          "Choisissez le type d'institution",
          "Saisissez le code marchand",
          "Entrez le numéro de référence : RWA.NYA.GAS.TWIZ.001",
          "Saisissez le montant",
          "Confirmez avec le code PIN",
        ],
        variants: [
          {
            telco: "mtn-business",
            code: "*182*8*5#",
            instructions: [
              "Composez *182*8*5#",
              "Choisissez 'Paiements de service'",
              "Fournissez l'ID SACCO",
              "Confirmez la contribution planifiée",
            ],
            notes: ["Réservé au personnel opérationnel"],
          },
        ],
      },
      {
        name: "Airtel Money",
        telco: "airtel",
        code: "*500#",
        instructions: [
          "Composez *500#",
          "Sélectionnez 'Pay Bills'",
          "Saisissez le code marchand",
          "Entrez le numéro de référence",
          "Indiquez le montant",
          "Confirmez avec le code PIN",
        ],
        variants: [
          {
            telco: "airtel-gsm",
            code: "*182*2*3#",
            instructions: [
              "Composez *182*2*3#",
              "Sélectionnez 'Contributions SACCO+'",
              "Entrez le numéro de membre",
              "Confirmez le montant",
            ],
          },
        ],
      },
    ],
    generalInstructions: [
      "Utilisez exactement le numéro de référence indiqué sur votre carte",
      "Vérifiez le montant avant de confirmer",
      "Conservez le SMS de confirmation comme preuve",
    ],
    fallbackMessage:
      "Si le code USSD échoue, composez *182*8*1# ou appelez le +250 788 000 000 pour obtenir de l'aide.",
  },

  legal: {
    termsUrl: "/legal/terms?lang=fr",
    privacyUrl: "/legal/privacy?lang=fr",
  },

  help: {
    paymentGuide: [
      "Assurez-vous d'avoir suffisamment de solde sur votre compte mobile money",
      "Utilisez exactement le numéro de référence tel qu'écrit sur votre carte",
      "Contactez votre SACCO si vous rencontrez un problème",
    ],
    troubleshooting: [
      "Si l'USSD échoue : essayez depuis un autre téléphone",
      "Si le paiement est rejeté : vérifiez le numéro de référence",
      "Si vous ne recevez pas de SMS : composez *182# pour consulter l'historique",
    ],
    contactInfo: {
      helpline: "+250 788 000 000",
      email: "support@sacco-plus.rw",
      hours: "Lundi - Vendredi, 8h00 - 17h00",
    },
  },

  tips: {
    dualSim: [
      "Si vous avez deux cartes SIM, utilisez la SIM MTN ou Airtel",
      "Assurez-vous que la SIM avec mobile money dispose de suffisamment de solde",
    ],
    networkIssues: [
      "Essayez dans une zone avec une meilleure couverture réseau",
      "Attendez quelques minutes et réessayez",
    ],
    marketDays: ["Le jour du marché est jeudi - Payez avant le marché"],
    contactless: [
      "Approchez votre carte SACCO+ des lecteurs NFC compatibles pour un accès rapide",
      "Gardez la carte à moins de 3 cm du lecteur jusqu'au signal sonore",
    ],
  },
};

export const frRWMessages: TranslationMessages = {
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
    memberCode: "Code membre",
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
    talkbackHint: "Touchez une fois pour entendre, deux fois pour ouvrir.",
    voiceoverHint: "Balayez vers la droite pour lire chaque instruction.",
  },

  offers: {
    title: "Offres",
    description: "Prêts personnalisés et offres négociées par votre SACCO.",
    cta: "Ouvrir les offres",
    upcoming: "Les prochaines offres apparaîtront automatiquement lorsqu'elles seront activées.",
  },
};

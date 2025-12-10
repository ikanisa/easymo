/**
 * English (Rwanda) Content Pack
 */

import type { CountryContentPack, TranslationMessages } from "../types/index.js";

export const enRWContentPack: CountryContentPack = {
  locale: "en-RW",
  countryISO3: "RWA",
  countryName: "Rwanda",

  ussd: {
    providers: [
      {
        name: "MTN Mobile Money",
        telco: "mtn",
        code: "*182*8*1#",
        instructions: [
          "Dial *182*8*1#",
          "Select institution type",
          "Enter merchant code",
          "Enter reference number: RWA.NYA.GAS.TWIZ.001",
          "Enter amount",
          "Confirm with PIN",
        ],
        variants: [
          {
            telco: "mtn-business",
            code: "*182*8*5#",
            instructions: [
              "Dial *182*8*5#",
              "Choose 'Service Payments'",
              "Provide SACCO ID",
              "Confirm the scheduled contribution",
            ],
            notes: ["Operations staff only"],
          },
        ],
      },
      {
        name: "Airtel Money",
        telco: "airtel",
        code: "*500#",
        instructions: [
          "Dial *500#",
          "Select 'Pay Bills'",
          "Enter merchant code",
          "Enter reference number",
          "Enter amount",
          "Confirm with PIN",
        ],
        variants: [
          {
            telco: "airtel-gsm",
            code: "*182*2*3#",
            instructions: [
              "Dial *182*2*3#",
              "Select 'SACCO+ Contributions'",
              "Enter member number",
              "Confirm amount",
            ],
          },
        ],
      },
    ],
    generalInstructions: [
      "Use the exact reference number from your card",
      "Double-check the amount before confirming",
      "Keep the confirmation SMS as proof",
    ],
    fallbackMessage: "If the USSD code fails, dial *182*8*1# or call +250 788 000 000 for support.",
  },

  legal: {
    termsUrl: "/legal/terms?lang=en",
    privacyUrl: "/legal/privacy?lang=en",
  },

  help: {
    paymentGuide: [
      "Ensure you have sufficient balance on your mobile money account",
      "Use the reference number exactly as written on your card",
      "Contact your SACCO if you encounter any issues",
    ],
    troubleshooting: [
      "If USSD fails: Try from a different phone",
      "If payment is rejected: Double-check the reference number",
      "If you don't receive SMS: Dial *182# to check transaction history",
    ],
    contactInfo: {
      helpline: "+250 788 000 000",
      email: "support@sacco-plus.rw",
      hours: "Monday - Friday, 8:00 AM - 5:00 PM",
    },
  },

  tips: {
    dualSim: [
      "If you have dual SIM, use the MTN or Airtel SIM",
      "Ensure the SIM with mobile money has sufficient balance",
    ],
    networkIssues: [
      "Try from a location with better network coverage",
      "Wait a few minutes and retry",
    ],
    marketDays: ["Market day is Thursday - Pay before market", "Tip: Pay early to avoid queues"],
    contactless: [
      "Tap your SACCO+ card on supported NFC readers for faster check-ins",
      "Keep the card within 3cm of the reader until you hear the tone",
    ],
  },
};

export const enRWMessages: TranslationMessages = {
  common: {
    welcome: "Welcome",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    loading: "Loading...",
    error: "Error",
    success: "Success",
  },

  payment: {
    title: "Payment",
    amount: "Amount",
    reference: "Reference Number",
    confirmPayment: "Confirm Payment",
    paymentSuccess: "Payment successful",
    paymentFailed: "Payment failed",
  },

  member: {
    title: "Member",
    name: "Name",
    phone: "Phone",
    memberCode: "Member Code",
    joinDate: "Join Date",
  },

  group: {
    title: "Group",
    groupName: "Group Name",
    groupCode: "Group Code",
    members: "Members",
    totalSavings: "Total Savings",
  },

  accessibility: {
    motionToggleLabel: "Toggle reduced motion",
    talkbackHint: "Single tap to focus, double tap to activate.",
    voiceoverHint: "Swipe right to read the next instruction.",
  },

  offers: {
    title: "Offers",
    description: "Personalised loans and marketplace deals from your SACCO.",
    cta: "Open Offers",
    upcoming: "Upcoming deals will surface automatically when enabled.",
  },
};

/**
 * Rwanda (Kinyarwanda) Content Pack
 */

import type { CountryContentPack, TranslationMessages } from "../types/index.js";

export const rwRWContentPack: CountryContentPack = {
  locale: "rw-RW",
  countryISO3: "RWA",
  countryName: "Rwanda",

  ussd: {
    providers: [
      {
        name: "MTN Mobile Money",
        telco: "mtn",
        code: "*182*8*1#",
        instructions: [
          "Kanda *182*8*1#",
          "Hitamo ubwoko bw'ikigo",
          "Injiza nimero y'ubucuruzi (merchant code)",
          "Injiza nimero y'imenyesha: RWA.NYA.GAS.TWIZ.001",
          "Injiza amafaranga (amount)",
          "Emeza PIN yawe",
        ],
        variants: [
          {
            telco: "mtn-business",
            code: "*182*8*5#",
            instructions: [
              "Kanda *182*8*5#",
              "Hitamo 'Kwishyura serivisi'",
              "Injiza SACCO ID",
              "Emeza amafaranga ya buri kwezi",
            ],
            notes: ["Iyi gahunda ikoreshwa n'abacungamutungo bemewe."],
          },
        ],
      },
      {
        name: "Airtel Money",
        telco: "airtel",
        code: "*500#",
        instructions: [
          "Kanda *500#",
          "Hitamo 'Kwishyura'",
          "Injiza nimero y'ubucuruzi",
          "Injiza nimero y'imenyesha",
          "Injiza amafaranga",
          "Emeza PIN yawe",
        ],
        variants: [
          {
            telco: "airtel-gsm",
            code: "*182*2*3#",
            instructions: [
              "Kanda *182*2*3#",
              "Hitamo 'SACCO+ ikimina'",
              "Injiza nimero y'umunyamuryango",
              "Emeza amafaranga ushaka gutanga",
            ],
          },
        ],
      },
    ],
    generalInstructions: [
      "Koresha nimero y'imenyesha nk'uko yanditswe ku karito kawe",
      "Emeza amafaranga mbere yo kwishyura",
      "Bika ubutumwa bw'kwishyura nk'ikimenyetso",
    ],
    fallbackMessage:
      "Niba code itagaragara, andika *182*8*1# cyangwa uhamagare +250 788 000 000 kugira ngo ubone ubufasha.",
  },

  legal: {
    termsUrl: "/legal/terms?lang=rw",
    privacyUrl: "/legal/privacy?lang=rw",
  },

  help: {
    paymentGuide: [
      "Banza ugenzure ko ufite amafaranga ahagije kuri konti yawe",
      "Koresha nimero y'imenyesha nk'uko yanditswe",
      "Niba hari ikibazo, vugana na SACCO yawe",
    ],
    troubleshooting: [
      "Niba USSD idakoze: Gerageza telefone yundi",
      "Niba kwishyura byanze: Reba neza nimero y'imenyesha",
      "Niba utabona ubutumwa: Hamagara kuri *182# ugenzure amateka",
    ],
    contactInfo: {
      helpline: "+250 788 000 000",
      email: "ubufasha@sacco-plus.rw",
      hours: "Kuwa mbere - Kuwa gatanu, 8:00 - 17:00",
    },
  },

  tips: {
    dualSim: [
      "Niba ufite SIM ebyiri, koresha iya MTN cyangwa Airtel",
      "Emeza ko SIM ikoresha Mobile Money ifite amafaranga",
    ],
    networkIssues: [
      "Gerageza ahantu hasanzwe haboneka umuyoboro",
      "Tegereza iminota mike maze ugerageze",
    ],
    marketDays: [
      "Isoko ni ku wa kane - Kwishyura mbere y'isoko",
      "Inama: Wishyure hakiri kare kugira ngo wirinde umurongo",
    ],
    contactless: [
      "Koresha NFC hamwe na karita yawe ya SACCO+ aho bishoboka",
      "Komeza karita yawe hafi y'ikorosi iri ku gikoresho mu masegonda 3-5",
    ],
  },
};

export const rwRWMessages: TranslationMessages = {
  common: {
    welcome: "Murakaza neza",
    save: "Bika",
    cancel: "Kuraho",
    delete: "Siba",
    edit: "Hindura",
    loading: "Gutwara...",
    error: "Ikosa",
    success: "Byagenze neza",
  },

  payment: {
    title: "Kwishyura",
    amount: "Amafaranga",
    reference: "Nimero y'imenyesha",
    confirmPayment: "Emeza kwishyura",
    paymentSuccess: "Kwishyura byagenze neza",
    paymentFailed: "Kwishyura ntibyagenze neza",
  },

  member: {
    title: "Umunyamuryango",
    name: "Amazina",
    phone: "Telefone",
    memberCode: "Nimero y'umunyamuryango",
    joinDate: "Itariki y'kwinjira",
  },

  group: {
    title: "Ikimina",
    groupName: "Izina ry'ikimina",
    groupCode: "Nimero y'ikimina",
    members: "Abanyamuryango",
    totalSavings: "Amafaranga yose",
  },

  accessibility: {
    motionToggleLabel: "Hindura imyanya y'imyanya igabanya imyanya",
    talkbackHint: "Kanda inshuro imwe kumva ibisobanuro, inshuro ebyiri gufungura.",
    voiceoverHint: "Komeza urusengero hanyuma ukore swipe kugirango usome intambwe zose.",
  },

  offers: {
    title: "Amahirwe mashya",
    description: "Reba amadeni yoroshye n'ibicuruzwa byateguwe na SACCO yawe.",
    cta: "Fungura 'Offers'",
    upcoming: "Ibijyanye n'ibicuruzwa bishya bizahita bigaragara ubungubu.",
  },
};

import { DEFAULT_LANGUAGE, type SupportedLanguage } from "./language.ts";

type TranslationKey = keyof typeof MESSAGES;

type Params = Record<string, string | number>;

const MESSAGES = {
  "common.home_button": {
    en: "🏠 Home",
    fr: "🏠 Accueil",
  },
  "common.buttons.open": {
    en: "Open",
    fr: "Ouvrir",
  },
  "common.buttons.select": {
    en: "Select",
    fr: "Sélectionner",
  },
  "common.buttons.choose": {
    en: "Choose",
    fr: "Choisir",
  },
  "guards.stop.confirm": {
    en: "You have been opted out. Reply START to opt back in.",
    fr: "Vous êtes désinscrit·e. Répondez START pour vous réabonner.",
  },
  "guards.start.confirm": {
    en: "You are now opted in. Sending the menu…",
    fr: "Vous êtes abonné·e. Nous envoyons le menu…",
  },
  "home.menu.title": {
    en: "easyMO Services",
    fr: "Services easyMO",
  },
  "home.menu.section": {
    en: "Quick actions",
    fr: "Actions rapides",
  },
  "home.menu.button": {
    en: "Open",
    fr: "Ouvrir",
  },
  "home.menu.greeting": {
    en: "Hello 👋 {{phone}}\nPage {{current}}/{{total}}",
    fr: "Bonjour 👋 {{phone}}\nPage {{current}}/{{total}}",
  },
  "home.rows.seeDrivers.title": {
    en: "🚖 Nearby Drivers",
    fr: "🚖 Chauffeurs à proximité",
  },
  "home.rows.seeDrivers.description": {
    en: "Find moto and cab partners close to you.",
    fr: "Trouvez des partenaires moto ou taxi proches de vous.",
  },
  "home.rows.seePassengers.title": {
    en: "🧍‍♀️ Nearby Passengers",
    fr: "🧍‍♀️ Passagers à proximité",
  },
  "home.rows.seePassengers.description": {
    en: "See riders nearby looking for a driver.",
    fr: "Voyez les passagers proches qui cherchent un chauffeur.",
  },
  "home.rows.scheduleTrip.title": {
    en: "🛵 Schedule Trip",
    fr: "🛵 Programmer un trajet",
  },
  "home.rows.scheduleTrip.description": {
    en: "Plan a future pickup for trusted drivers.",
    fr: "Planifiez un retrait futur avec vos chauffeurs de confiance.",
  },
  "home.rows.marketplace.title": {
    en: "🛍️ Marketplace",
    fr: "🛍️ Marché",
  },
  "home.rows.marketplace.description": {
    en: "Discover local sellers or list your business.",
    fr: "Découvrez des vendeurs locaux ou publiez votre activité.",
  },
  "home.rows.baskets.title": {
    en: "🪣 Baskets",
    fr: "🪣 Tontines",
  },
  "home.rows.baskets.description": {
    en: "Create or join a saving basket with friends.",
    fr: "Créez ou rejoignez une tontine avec vos proches.",
  },
  "home.rows.motorInsurance.title": {
    en: "🛡️ Motor Insurance",
    fr: "🛡️ Assurance moto",
  },
  "home.rows.motorInsurance.description": {
    en: "Upload documents and request insurance cover.",
    fr: "Envoyez vos documents et demandez une couverture d'assurance.",
  },
  "home.rows.momoQr.title": {
    en: "💳 MoMo QR",
    fr: "💳 MoMo QR",
  },
  "home.rows.momoQr.description": {
    en: "Generate or scan MoMo QR codes instantly.",
    fr: "Générez ou scannez des QR codes MoMo instantanément.",
  },
  "home.rows.wallet.title": {
    en: "💎 Wallet & Tokens",
    fr: "💎 Portefeuille & jetons",
  },
  "home.rows.wallet.description": {
    en: "Check rewards, redeem tokens, and track history.",
    fr:
      "Consultez vos récompenses, utilisez vos jetons et suivez votre historique.",
  },
  "home.rows.dineIn.title": {
    en: "🍽️ Bars & Restaurants",
    fr: "🍽️ Bars & restaurants",
  },
  "home.rows.dineIn.description": {
    en: "Order from partner bars with one tap.",
    fr: "Commandez chez nos bars partenaires en un clic.",
  },
  "home.rows.admin.title": {
    en: "🛠️ Admin",
    fr: "🛠️ Admin",
  },
  "home.rows.admin.description": {
    en: "Open the operations hub for staff tools.",
    fr: "Ouvrez le centre des opérations pour les outils équipe.",
  },
  "home.extras.back.title": {
    en: "◀ Back",
    fr: "◀ Retour",
  },
  "home.extras.back.description": {
    en: "See the previous services.",
    fr: "Voir les services précédents.",
  },
  "home.extras.more.title": {
    en: "➡️ More services",
    fr: "➡️ Plus de services",
  },
  "home.extras.more.description": {
    en: "View additional easyMO services.",
    fr: "Découvrir d'autres services easyMO.",
  },
  "insurance.blocked": {
    en: "This feature isn’t available in your country.",
    fr: "Cette fonctionnalité n’est pas disponible dans votre pays.",
  },
} as const;

export function t(
  locale: SupportedLanguage,
  key: TranslationKey,
  params: Params = {},
): string {
  const entry = MESSAGES[key];
  if (!entry) return key;
  const template = entry[locale] ?? entry[DEFAULT_LANGUAGE];
  return applyParams(template ?? key, params);
}

function applyParams(template: string, params: Params): string {
  return template.replace(/{{\s*(\w+)\s*}}/g, (_match, token) => {
    const value = params[token];
    return value === undefined ? "" : String(value);
  });
}

export type { TranslationKey };

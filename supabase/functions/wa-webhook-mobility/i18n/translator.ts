import { DEFAULT_LANGUAGE, type SupportedLanguage } from "./language.ts";

// Inline minimal translations to avoid JSON bundling issues
// Full translations would be loaded from the database in production
const MINIMAL_TRANSLATIONS: Record<string, Record<string, string>> = {
  en: {
    "common.home_button": "🏠 Home",
    "common.back": "⬅️ Back",
    "mobility.nearby.vehicle.moto.title": "🏍️ Motorcycle",
    "mobility.nearby.vehicle.car.title": "🚗 Car",
    "mobility.nearby.vehicle.van.title": "🚐 Van",
    "mobility.nearby.drivers.prompt":
      "Share your location to find nearby drivers.",
    "mobility.nearby.passengers.prompt":
      "Share your location to find nearby passengers.",
    "mobility.nearby.no_matches": "No matches found nearby. Try again later.",
    "mobility.schedule.role.prompt": "Are you a driver or passenger?",
    "mobility.schedule.location.prompt": "Share your pickup location.",
    "mobility.schedule.success": "Trip scheduled successfully!",
    "mobility.go_online.prompt": "Share your location to go online.",
    "mobility.go_online.success":
      "You are now online and visible to passengers!",
    "mobility.go_offline.success": "You are now offline.",
    "location.share.instructions":
      "Tap the + button, then 'Location' to share your current location.",
  },
  fr: {
    "common.home_button": "🏠 Accueil",
    "common.back": "⬅️ Retour",
    "mobility.nearby.vehicle.moto.title": "🏍️ Moto",
    "mobility.nearby.vehicle.car.title": "🚗 Voiture",
    "mobility.nearby.vehicle.van.title": "🚐 Van",
    "mobility.nearby.drivers.prompt":
      "Partagez votre position pour trouver des chauffeurs à proximité.",
    "mobility.nearby.passengers.prompt":
      "Partagez votre position pour trouver des passagers à proximité.",
    "mobility.nearby.no_matches":
      "Aucune correspondance trouvée. Réessayez plus tard.",
    "mobility.schedule.role.prompt": "Êtes-vous chauffeur ou passager?",
    "mobility.schedule.location.prompt":
      "Partagez votre lieu de prise en charge.",
    "mobility.schedule.success": "Voyage planifié avec succès!",
    "mobility.go_online.prompt":
      "Partagez votre position pour vous mettre en ligne.",
    "mobility.go_online.success":
      "Vous êtes maintenant en ligne et visible pour les passagers!",
    "mobility.go_offline.success": "Vous êtes maintenant hors ligne.",
    "location.share.instructions":
      "Appuyez sur le bouton +, puis 'Position' pour partager votre position actuelle.",
  },
};

type Params = Record<string, string | number>;

export type TranslationKey = string;

export function t(
  locale: SupportedLanguage,
  key: TranslationKey,
  params: Params = {},
): string {
  const catalog = MINIMAL_TRANSLATIONS[locale] ??
    MINIMAL_TRANSLATIONS[DEFAULT_LANGUAGE] ?? {};
  const fallback = MINIMAL_TRANSLATIONS[DEFAULT_LANGUAGE] ?? {};
  const phrase = catalog[key] ?? fallback[key] ?? key;
  return applyParams(phrase, params);
}

function applyParams(phrase: string, params: Params): string {
  return phrase.replace(/{{\s*(\w+)\s*}}/g, (_match, token) => {
    const value = params[token];
    return value === undefined ? "" : String(value);
  });
}

import { DetectionResult } from "./detection.js";
import { ToneLocale, ToneProfile } from "./types.js";

const TONE_PROFILES: Record<ToneLocale, ToneProfile> = {
  en: {
    locale: "en",
    label: "English",
    sampleGreeting: "Hello there!",
    summary: "Use a concise, professional WhatsApp voice with clear bullet points.",
  },
  sw: {
    locale: "sw",
    label: "Kiswahili",
    sampleGreeting: "Habari yako rafiki yangu!",
    summary:
      "Lean into a warm, communal tone. Mix in Kiswahili honorifics and keep sentences short.",
  },
};

export function getToneProfile(locale: ToneLocale): ToneProfile {
  return TONE_PROFILES[locale] ?? TONE_PROFILES.en;
}

export function buildToneDirective(result: DetectionResult): string {
  const profile = getToneProfile(result.locale);
  if (profile.locale === "sw") {
    return [
      "When you notice Kiswahili cues, answer fully in Kiswahili with a warm, encouraging voice.",
      "Use inclusive phrases like 'tupo pamoja' or 'tafadhali tupatie taarifa' when helpful.",
      "Mirror the user's casual tone but keep instructions actionable.",
    ].join(" ");
  }

  return "Default to concise English with direct calls-to-action and avoid overly formal language.";
}

export function mapToneLocaleToLanguage(locale: ToneLocale): string {
  return locale === "sw" ? "sw" : "en";
}

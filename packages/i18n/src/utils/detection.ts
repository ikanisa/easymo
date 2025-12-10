import { ToneLocale } from "./types.js";

const SWAHILI_HINTS = [
  "habari",
  "nashukuru",
  "tafadhali",
  "karibu",
  "mkulima",
  "bei",
  "mzigo",
  "malipo",
  "kesho",
  "leo",
  "shamba",
  "mazao",
  "nani",
  "safi",
  "pole",
];

const ENGLISH_HINTS = [
  "please",
  "thanks",
  "price",
  "farmer",
  "pickup",
  "harvest",
  "cash",
  "order",
  "ready",
  "today",
  "tomorrow",
  "market",
  "hello",
];

export type DetectionResult = {
  locale: ToneLocale;
  swahiliScore: number;
  englishScore: number;
};

export function detectToneLocale(text: string | null | undefined): DetectionResult {
  if (!text || !text.trim()) {
    return { locale: "en", swahiliScore: 0, englishScore: 0 };
  }

  const normalized = text.toLowerCase();
  const swahiliScore = scoreLocale(normalized, SWAHILI_HINTS);
  const englishScore = scoreLocale(normalized, ENGLISH_HINTS);

  if (swahiliScore === 0 && englishScore === 0) {
    // fall back to character heuristic for Swahili vowels + syllables
    const vowelDensity = normalized.replace(/[^aeiou]/g, "").length / normalized.length;
    if (vowelDensity > 0.45) {
      return { locale: "sw", swahiliScore: 0.3, englishScore: 0 };
    }
    return { locale: "en", swahiliScore: 0, englishScore: 0 };
  }

  if (swahiliScore >= englishScore * 1.2) {
    return { locale: "sw", swahiliScore, englishScore };
  }

  return { locale: "en", swahiliScore, englishScore };
}

function scoreLocale(text: string, hints: string[]): number {
  let score = 0;
  for (const hint of hints) {
    if (text.includes(hint)) {
      score += 1;
    }
  }
  return score;
}

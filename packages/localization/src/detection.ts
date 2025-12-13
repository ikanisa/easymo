import { ToneLocale } from "./types.ts";

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
  englishScore: number;
};

export function detectToneLocale(text: string | null | undefined): DetectionResult {
  if (!text || !text.trim()) {
    return { locale: "en", englishScore: 0 };
  }

  const normalized = text.toLowerCase();
  const englishScore = scoreLocale(normalized, ENGLISH_HINTS);

  return { locale: "en", englishScore };
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

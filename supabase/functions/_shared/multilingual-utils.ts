// =====================================================
// MULTILINGUAL UTILITIES
// =====================================================
// Language detection & translation for Kinyarwanda/English/French
// =====================================================

import OpenAI from "https://deno.land/x/openai@v4.20.0/mod.ts";
import {
  requireFirstMessageContent,
} from "../../../packages/shared/src/openaiGuard.ts";

const openai = new OpenAI({
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
});

export type Language = "rw" | "en" | "fr";

/**
 * Detect dominant language from text
 */
export async function detectLanguage(text: string): Promise<Language> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Detect the dominant language. Reply with ONLY: rw (Kinyarwanda), en (English), or fr (French)."
        },
        {
          role: "user",
          content: `Detect language: ${text}`
        }
      ],
      temperature: 0,
      max_tokens: 5,
    });

    const result = requireFirstMessageContent(
      response,
      "Language detection"
    )
      .trim()
      .toLowerCase();
    
    if (result === "rw" || result === "en" || result === "fr") {
      return result as Language;
    }
    
    // Default to English if uncertain
    return "en";
  } catch (error) {
    console.error("Language detection error:", error);
    return "en"; // Default
  }
}

/**
 * Translate text between languages
 */
export async function translateText(
  text: string,
  targetLang: Language,
  sourceLang?: Language
): Promise<string> {
  try {
    const languageNames: Record<Language, string> = {
      rw: "Kinyarwanda",
      en: "English",
      fr: "French"
    };

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a professional translator specializing in ${languageNames[targetLang]}. Translate accurately and naturally. Preserve tone and meaning. Return ONLY the translation.`
        },
        {
          role: "user",
          content: `Translate to ${languageNames[targetLang]}:\n\n${text}`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    return (
      requireFirstMessageContent(response, "Text translation").trim() || text
    );
  } catch (error) {
    console.error("Translation error:", error);
    return text; // Return original if translation fails
  }
}

/**
 * Get language name
 */
export function getLanguageName(code: Language): string {
  const names: Record<Language, string> = {
    rw: "Kinyarwanda",
    en: "English",
    fr: "Français"
  };
  return names[code] || "English";
}

/**
 * Get country from language
 */
export function getCountryFromLanguage(lang: Language): string {
  const countries: Record<Language, string> = {
    rw: "Rwanda",
    en: "Malta", // Default for English in this context
    fr: "Rwanda" // French is also used in Rwanda
  };
  return countries[lang];
}

/**
 * Language Detection Module
 *
 * Detects user language from messages and handles explicit overrides.
 * Priority: explicit override → message content → default 'en'
 */

export type Language = 'en' | 'fr' | 'rw';

// =============================================================================
// Language Markers
// =============================================================================

const KINYARWANDA_MARKERS = [
    'murakoze',
    'muraho',
    'amakuru',
    'ndashaka',
    'mwiriwe',
    'yego',
    'oya',
    'ijoro ryiza',
    'bite',
    'nibyo',
    'tugende',
    'ndagukunda',
    'urabeho',
    'mwaramutse',
    'mwirirwe',
];

const FRENCH_MARKERS = [
    'bonjour',
    'bonsoir',
    'merci',
    'je voudrais',
    "s'il vous plaît",
    'comment',
    'oui',
    'non',
    'je cherche',
    'je veux',
    'salut',
    'bonne',
    'pardon',
    'excusez',
    "d'accord",
];

const ENGLISH_MARKERS = [
    'hello',
    'hi',
    'thanks',
    'thank you',
    'please',
    'i want',
    'i need',
    'yes',
    'no',
    'looking for',
    'good morning',
    'good evening',
    'okay',
    'ok',
];

// =============================================================================
// Explicit Override Patterns
// =============================================================================

const OVERRIDE_PATTERNS: { pattern: RegExp; lang: Language }[] = [
    { pattern: /^(english|en)$/i, lang: 'en' },
    { pattern: /^(fran[çc]ais|french|fr)$/i, lang: 'fr' },
    { pattern: /^(kinyarwanda|ikinyarwanda|rw)$/i, lang: 'rw' },
];

// =============================================================================
// Public API
// =============================================================================

/**
 * Parse explicit language override from a message.
 * Returns the language if the message is an override command, null otherwise.
 */
export function parseExplicitOverride(text: string): Language | null {
    const trimmed = text.trim();
    for (const { pattern, lang } of OVERRIDE_PATTERNS) {
        if (pattern.test(trimmed)) {
            return lang;
        }
    }
    return null;
}

/**
 * Detect language from an array of messages.
 * Analyzes markers in the text to determine the most likely language.
 *
 * @param messages - Array of message texts (typically first 1-3 messages)
 * @returns Detected language code
 */
export function detectLanguage(messages: string[]): Language {
    const combined = messages.join(' ').toLowerCase();

    // Check for explicit override first
    for (const msg of messages) {
        const override = parseExplicitOverride(msg);
        if (override) {
            return override;
        }
    }

    // Count marker matches
    const scores: Record<Language, number> = { en: 0, fr: 0, rw: 0 };

    for (const marker of KINYARWANDA_MARKERS) {
        if (combined.includes(marker)) {
            scores.rw += 1;
        }
    }

    for (const marker of FRENCH_MARKERS) {
        if (combined.includes(marker)) {
            scores.fr += 1;
        }
    }

    for (const marker of ENGLISH_MARKERS) {
        if (combined.includes(marker)) {
            scores.en += 1;
        }
    }

    // Return language with highest score, default to 'en'
    if (scores.rw > scores.fr && scores.rw > scores.en) {
        return 'rw';
    }
    if (scores.fr > scores.en) {
        return 'fr';
    }
    return 'en';
}

/**
 * Determine if a language should be updated based on new message.
 * Only updates if explicit override detected.
 */
export function shouldUpdateLanguage(
    currentLanguage: Language,
    newMessage: string
): { shouldUpdate: boolean; newLanguage: Language } {
    const override = parseExplicitOverride(newMessage);
    if (override && override !== currentLanguage) {
        return { shouldUpdate: true, newLanguage: override };
    }
    return { shouldUpdate: false, newLanguage: currentLanguage };
}

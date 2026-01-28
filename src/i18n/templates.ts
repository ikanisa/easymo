/**
 * Template Library for Multilingual Messages
 *
 * Provides localized templates for all client-facing WhatsApp messages.
 * Supports EN, FR, RW with variable interpolation.
 */

import type { Language } from './detectLanguage';

// =============================================================================
// Template Keys
// =============================================================================

export type TemplateKey =
    | 'processing_image'
    | 'clarify_questions'
    | 'checking_vendors'
    | 'still_waiting'
    | 'shortlist_intro'
    | 'shortlist_item_line'
    | 'handoff_footer'
    | 'apology_no_results'
    | 'consent_request_call'
    | 'consent_confirm_yes'
    | 'consent_confirm_no'
    | 'fallback_message'
    | 'ocr_low_confidence';

// =============================================================================
// Template Definitions
// =============================================================================

export const TEMPLATES: Record<TemplateKey, Record<Language, string>> = {
    processing_image: {
        en: 'Processing your image...',
        fr: 'Traitement de votre image...',
        rw: 'Turimo gusuzuma ifoto yawe...',
    },
    clarify_questions: {
        en: 'I have a few questions:',
        fr: "J'ai quelques questions :",
        rw: 'Mfite ibibazo bike:',
    },
    checking_vendors: {
        en: 'Checking with vendors...',
        fr: 'Vérification auprès des vendeurs...',
        rw: 'Turimo kureba abacuruzi...',
    },
    still_waiting: {
        en: 'Still waiting for replies...',
        fr: 'En attente des réponses...',
        rw: 'Turindiriye ibisubizo...',
    },
    shortlist_intro: {
        en: 'I found {count} options for you:',
        fr: "J'ai trouvé {count} options pour vous :",
        rw: 'Nabonye amahitamo {count}:',
    },
    shortlist_item_line: {
        en: '{index}. {vendor_name} — {price} — {availability}',
        fr: '{index}. {vendor_name} — {price} — {availability}',
        rw: '{index}. {vendor_name} — {price} — {availability}',
    },
    handoff_footer: {
        en: 'Tap the link to contact the vendor directly.',
        fr: 'Appuyez sur le lien pour contacter le vendeur.',
        rw: 'Kanda kuri link kugira ngo uvugane n\'umucuruzi.',
    },
    apology_no_results: {
        en: 'Sorry, no vendors available right now. Try again later.',
        fr: 'Désolé, aucun vendeur disponible pour le moment. Réessayez plus tard.',
        rw: 'Ihangane, nta bacuruzi bahari ubu. Ongera ugerageze nyuma.',
    },
    consent_request_call: {
        en: 'Can I call you to help faster? Reply YES or NO.',
        fr: 'Puis-je vous appeler pour vous aider plus rapidement ? Répondez OUI ou NON.',
        rw: 'Nakugana kugira ngo ngufashe vuba? Subiza YEGO cyangwa OYA.',
    },
    consent_confirm_yes: {
        en: "Thanks! I'll call you shortly.",
        fr: 'Merci ! Je vous appelle bientôt.',
        rw: 'Urakoze! Nzaguhamagara vuba.',
    },
    consent_confirm_no: {
        en: "No problem, I'll continue via chat.",
        fr: 'Pas de problème, je continue par message.',
        rw: 'Nta kibazo, nzakomeza ku butumwa.',
    },
    fallback_message: {
        en: 'Thank you for your message. An agent will respond shortly.',
        fr: 'Merci pour votre message. Un agent va vous répondre bientôt.',
        rw: 'Urakoze ku butumwa bwawe. Umukozi azagusubiza vuba.',
    },
    ocr_low_confidence: {
        en: "I couldn't read some parts clearly. Can you confirm: {items}?",
        fr: "Je n'ai pas pu lire certaines parties clairement. Pouvez-vous confirmer : {items} ?",
        rw: 'Sinashoboye gusoma neza ibice bimwe. Wemeza: {items}?',
    },
};

// =============================================================================
// Public API
// =============================================================================

/**
 * Get a template string for a given key and language.
 * Falls back to English if template not found.
 */
export function getTemplate(key: TemplateKey, lang: Language): string {
    const template = TEMPLATES[key];
    if (!template) {
        console.warn(`[i18n] Unknown template key: ${key}`);
        return '';
    }
    return template[lang] ?? template.en;
}

/**
 * Render a template with variable substitution.
 *
 * @param key - Template key
 * @param lang - Language code
 * @param vars - Variables to substitute (e.g., { count: '3', vendor_name: 'Pharmacy Plus' })
 * @returns Rendered template string
 */
export function renderTemplate(
    key: TemplateKey,
    lang: Language,
    vars?: Record<string, string | number>
): string {
    let template = getTemplate(key, lang);

    if (vars) {
        for (const [varName, value] of Object.entries(vars)) {
            template = template.replace(new RegExp(`\\{${varName}\\}`, 'g'), String(value));
        }
    }

    return template;
}

/**
 * Get bilingual fallback message (EN + FR).
 * Used when language is uncertain.
 */
export function getBilingualFallback(): string {
    return `${TEMPLATES.fallback_message.en} / ${TEMPLATES.fallback_message.fr}`;
}

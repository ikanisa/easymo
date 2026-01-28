/**
 * WhatsApp Shortlist Formatter Module
 *
 * Formats shortlist for WhatsApp delivery with wa.me handoff links.
 */

import type { ShortlistCandidate, FormattedShortlist, FormattedVendorEntry } from './types';

// =============================================================================
// Constants
// =============================================================================

const MAX_VENDORS = 5;
const MAX_MESSAGES = 2;
const MAX_MESSAGE_LENGTH = 1600; // WhatsApp limit is ~4096, but keep it readable

// =============================================================================
// Main Formatter Function
// =============================================================================

/**
 * Format a ranked shortlist for WhatsApp delivery.
 */
export function formatShortlistForWhatsApp(
    candidates: ShortlistCandidate[],
    options: {
        language?: 'en' | 'fr' | 'rw';
        intro_override?: string;
    } = {}
): FormattedShortlist {
    const language = options.language ?? 'en';

    // Limit to max vendors
    const limitedCandidates = candidates.slice(0, MAX_VENDORS);

    // Format each vendor entry
    const vendorEntries = limitedCandidates.map((c, index) =>
        formatVendorEntry(c, index + 1, language)
    );

    // Build messages
    const summary = options.intro_override ?? getIntroText(language);
    const closing = getClosingText(language);
    const messages = buildMessages(summary, vendorEntries, closing);

    return {
        summary,
        vendors: vendorEntries,
        messages,
        closing,
    };
}

// =============================================================================
// Vendor Entry Formatter
// =============================================================================

function formatVendorEntry(
    candidate: ShortlistCandidate,
    index: number,
    language: 'en' | 'fr' | 'rw'
): FormattedVendorEntry {
    const { vendor_name, vendor_phone, reply, location_note } = candidate;

    // Format price range
    const price_range = formatPriceRange(reply.price_min, reply.price_max);

    // Format stock status
    const stock_status = formatStockStatus(reply.availability, language);

    // Format location
    const location = location_note ?? getDefaultLocation(language);

    // Build wa.me link
    const wa_link = buildWaMeLink(vendor_phone);

    return {
        name: vendor_name,
        price_range,
        stock_status,
        location,
        wa_link,
    };
}

// =============================================================================
// Price Formatting
// =============================================================================

function formatPriceRange(
    priceMin?: number,
    priceMax?: number
): string {
    if (priceMin === undefined && priceMax === undefined) {
        return 'Price on request';
    }

    const formatPrice = (p: number): string => {
        if (p >= 1000) {
            const k = p / 1000;
            return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
        }
        return p.toString();
    };

    if (priceMin === priceMax || priceMax === undefined) {
        return `${formatPrice(priceMin!)} RWF`;
    }

    return `${formatPrice(priceMin!)}–${formatPrice(priceMax)} RWF`;
}

// =============================================================================
// Stock Status Formatting
// =============================================================================

function formatStockStatus(
    availability: 'in_stock' | 'out_of_stock' | 'unclear',
    language: 'en' | 'fr' | 'rw'
): string {
    const translations = {
        en: {
            in_stock: 'In stock',
            out_of_stock: 'Out of stock',
            unclear: 'Check availability',
        },
        fr: {
            in_stock: 'En stock',
            out_of_stock: 'Rupture',
            unclear: 'À vérifier',
        },
        rw: {
            in_stock: 'Iri',
            out_of_stock: 'Ntiri',
            unclear: 'Reba',
        },
    };

    return translations[language][availability];
}

// =============================================================================
// wa.me Link Builder
// =============================================================================

/**
 * Build a valid wa.me link from a phone number.
 * Ensures E.164 format (no + prefix in URL).
 */
export function buildWaMeLink(phone: string, message?: string): string {
    // Clean phone number: remove all non-digits except leading +
    let cleaned = phone.replace(/[^\d+]/g, '');

    // Remove leading + for wa.me (it expects just digits)
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.slice(1);
    }

    // Ensure Rwanda country code if missing (assuming local numbers)
    if (cleaned.length <= 10 && !cleaned.startsWith('250')) {
        // Remove leading 0 if present
        if (cleaned.startsWith('0')) {
            cleaned = cleaned.slice(1);
        }
        cleaned = '250' + cleaned;
    }

    let url = `https://wa.me/${cleaned}`;

    if (message) {
        url += `?text=${encodeURIComponent(message)}`;
    }

    return url;
}

/**
 * Validate that a phone number can produce a valid wa.me link.
 */
export function isValidWaMePhone(phone: string): boolean {
    const cleaned = phone.replace(/[^\d]/g, '');
    // Must have at least 9 digits (country code + number)
    return cleaned.length >= 9 && cleaned.length <= 15;
}

// =============================================================================
// Message Builder
// =============================================================================

function buildMessages(
    summary: string,
    vendors: FormattedVendorEntry[],
    closing: string
): string[] {
    const messages: string[] = [];

    // First message: summary + vendors
    let currentMessage = summary + '\n\n';
    let vendorIndex = 0;

    for (const vendor of vendors) {
        const line = formatVendorLine(vendor, vendorIndex + 1);

        // Check if adding this line would exceed limit
        if (currentMessage.length + line.length > MAX_MESSAGE_LENGTH) {
            // Start a new message
            messages.push(currentMessage.trim());

            if (messages.length >= MAX_MESSAGES) {
                break; // Stop if we've hit max messages
            }

            currentMessage = '';
        }

        currentMessage += line + '\n';
        vendorIndex++;
    }

    // Add closing if it fits
    if (currentMessage.length + closing.length <= MAX_MESSAGE_LENGTH) {
        currentMessage += '\n' + closing;
    }

    if (currentMessage.trim()) {
        messages.push(currentMessage.trim());
    }

    return messages.slice(0, MAX_MESSAGES);
}

function formatVendorLine(vendor: FormattedVendorEntry, index: number): string {
    // Format: "1) VendorName — 15k–30k RWF — In stock — Location"
    //         "   👉 wa.me/..."
    return (
        `${index}) ${vendor.name} — ${vendor.price_range} — ${vendor.stock_status} — ${vendor.location}\n` +
        `   👉 ${vendor.wa_link}`
    );
}

// =============================================================================
// Localized Text
// =============================================================================

function getIntroText(language: 'en' | 'fr' | 'rw'): string {
    const texts = {
        en: "Here are the best matches I found for you:",
        fr: "Voici les meilleures options trouvées :",
        rw: "Dore ibyo nabonye bikwiye:",
    };
    return texts[language];
}

function getClosingText(language: 'en' | 'fr' | 'rw'): string {
    const texts = {
        en: "Tap a link to chat directly with the vendor. Good luck! 🛒",
        fr: "Cliquez sur un lien pour contacter le vendeur. Bonne chance ! 🛒",
        rw: "Kanda link uvugane n'umucuruzi. Amahirwe ! 🛒",
    };
    return texts[language];
}

function getDefaultLocation(language: 'en' | 'fr' | 'rw'): string {
    const texts = {
        en: 'Location on request',
        fr: 'Emplacement sur demande',
        rw: 'Aho ari babwire',
    };
    return texts[language];
}

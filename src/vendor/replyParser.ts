/**
 * Vendor Reply Parser Module
 * 
 * Parses unstructured vendor WhatsApp replies into structured data.
 */

import type { ParsedVendorReply } from '@easymo/types';

// =============================================================================
// Main Parser Function
// =============================================================================

/**
 * Parse a vendor's WhatsApp reply into structured fields.
 * 
 * @param rawMessage - The raw text message from vendor
 * @returns Parsed reply with availability, price, location, etc.
 */
export function parseVendorReply(rawMessage: string): ParsedVendorReply {
    const warnings: string[] = [];
    const normalizedMessage = rawMessage.toLowerCase().trim();

    // Parse availability
    const availability = parseAvailability(normalizedMessage);

    // Parse prices
    const { price_min, price_max, priceWarnings } = parsePrices(rawMessage);
    warnings.push(...priceWarnings);

    // Parse location
    const location_note = parseLocation(rawMessage);

    // Parse options
    const options = parseOptions(rawMessage);

    // Calculate confidence
    const confidence = calculateConfidence({
        availability,
        has_price: price_min !== undefined,
        has_location: location_note !== undefined,
        message_length: rawMessage.length,
    });

    return {
        availability,
        price_min,
        price_max,
        location_note,
        options: options.length > 0 ? options : undefined,
        confidence,
        warnings: warnings.length > 0 ? warnings : undefined,
    };
}

// =============================================================================
// Availability Parsing
// =============================================================================

const POSITIVE_KEYWORDS = [
    'yes', 'available', 'in stock', 'have', 'got', 'ready', 'confirmed',
    'niba', 'iri', 'dufite', // Kinyarwanda: yes, is there, we have
    'oui', 'disponible', // French
];

const NEGATIVE_KEYWORDS = [
    'no', 'not available', 'out of stock', 'don\'t have', 'sold out',
    'ntibayo', 'ntidufite', // Kinyarwanda: not there, we don't have
    'non', 'pas disponible', // French
];

function parseAvailability(message: string): 'in_stock' | 'out_of_stock' | 'unclear' {
    // Check numbered response format (e.g., "1. yes")
    const numberedMatch = message.match(/1\.\s*(yes|no|available|not available|have|don't have)/i);
    if (numberedMatch) {
        const answer = numberedMatch[1].toLowerCase();
        if (POSITIVE_KEYWORDS.some(k => answer.includes(k))) return 'in_stock';
        if (NEGATIVE_KEYWORDS.some(k => answer.includes(k))) return 'out_of_stock';
    }

    // Check for positive indicators
    for (const keyword of POSITIVE_KEYWORDS) {
        if (message.includes(keyword)) {
            // Make sure it's not negated
            const negationPatterns = [`not ${keyword}`, `no ${keyword}`, `don't ${keyword}`];
            const hasNegation = negationPatterns.some(p => message.includes(p));
            if (!hasNegation) return 'in_stock';
        }
    }

    // Check for negative indicators
    for (const keyword of NEGATIVE_KEYWORDS) {
        if (message.includes(keyword)) return 'out_of_stock';
    }

    return 'unclear';
}

// =============================================================================
// Price Parsing
// =============================================================================

interface PriceParseResult {
    price_min?: number;
    price_max?: number;
    priceWarnings: string[];
}

function parsePrices(message: string): PriceParseResult {
    const warnings: string[] = [];

    // Patterns to match
    const patterns = [
        // Range patterns: "15k-30k", "15,000-30,000", "15000 to 30000"
        /(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?\s*[-–—to]\s*(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?/gi,
        // Single value with k: "15k", "20K"
        /(\d{1,3}(?:\.\d+)?)\s*k\b/gi,
        // Single value with RWF/Rwf: "15000 RWF", "RWF 15000"
        /(?:rwf\s*)?(\d{1,3}(?:,?\d{3})+)(?:\s*rwf)?/gi,
        // Numbered response: "2. 15k-20k" or "2. 15000"
        /2\.\s*(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?\s*(?:[-–—to]\s*(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?)?/gi,
    ];

    let price_min: number | undefined;
    let price_max: number | undefined;

    // Try numbered format first (most reliable)
    const numberedMatch = message.match(/2\.\s*(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?\s*(?:[-–—to]\s*(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?)?/i);
    if (numberedMatch) {
        price_min = parsePrice(numberedMatch[1], message.includes('k'));
        if (numberedMatch[2]) {
            price_max = parsePrice(numberedMatch[2], message.includes('k'));
        } else {
            price_max = price_min;
        }
        return { price_min, price_max, priceWarnings: warnings };
    }

    // Try range patterns
    const rangeMatch = message.match(/(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?\s*[-–—to]\s*(\d{1,3}(?:,?\d{3})*(?:\.\d+)?)\s*k?/i);
    if (rangeMatch) {
        const hasK = message.toLowerCase().includes('k');
        price_min = parsePrice(rangeMatch[1], hasK && !rangeMatch[1].includes(','));
        price_max = parsePrice(rangeMatch[2], hasK && !rangeMatch[2].includes(','));
        return { price_min, price_max, priceWarnings: warnings };
    }

    // Try single value with k
    const kMatch = message.match(/(\d{1,3}(?:\.\d+)?)\s*k\b/i);
    if (kMatch) {
        price_min = parsePrice(kMatch[1], true);
        price_max = price_min;
        return { price_min, price_max, priceWarnings: warnings };
    }

    // Try single value (large numbers likely RWF)
    const numMatch = message.match(/(\d{1,3}(?:,?\d{3})+)/);
    if (numMatch) {
        price_min = parsePrice(numMatch[1], false);
        price_max = price_min;
        return { price_min, price_max, priceWarnings: warnings };
    }

    return { price_min: undefined, price_max: undefined, priceWarnings: warnings };
}

function parsePrice(value: string, isK: boolean): number {
    // Remove commas and parse
    const cleaned = value.replace(/,/g, '');
    let num = parseFloat(cleaned);

    // Apply k multiplier
    if (isK) {
        num *= 1000;
    }

    return Math.round(num);
}

// =============================================================================
// Location Parsing
// =============================================================================

const LOCATION_KEYWORDS = [
    'kimironko', 'nyabugogo', 'remera', 'kicukiro', 'gasabo', 'nyarugenge',
    'downtown', 'town', 'center', 'centre', 'near', 'opposite', 'next to',
    'floor', 'building', 'shop', 'market', 'mall',
];

function parseLocation(message: string): string | undefined {
    // Check for numbered format: "3. Kimironko market" (stop before "4.")
    const numberedMatch = message.match(/3\.\s*([^\n]+?)(?:\s+4\.|$)/i);
    if (numberedMatch) {
        const location = numberedMatch[1].trim();
        if (location.length > 2 && location.length < 100) {
            return location;
        }
    }

    // Look for sentences with location keywords
    const messageLower = message.toLowerCase();
    for (const keyword of LOCATION_KEYWORDS) {
        const idx = messageLower.indexOf(keyword);
        if (idx !== -1) {
            // Extract surrounding context (up to 50 chars before/after)
            const start = Math.max(0, idx - 20);
            const end = Math.min(message.length, idx + keyword.length + 30);
            const context = message.slice(start, end).trim();
            if (context.length > 3) {
                return context;
            }
        }
    }

    return undefined;
}

// =============================================================================
// Options Parsing
// =============================================================================

function parseOptions(message: string): string[] {
    const options: string[] = [];

    // Check for numbered format: "4. black or white"
    const numberedMatch = message.match(/4\.\s*([^\n]+)/i);
    if (numberedMatch) {
        const optionsText = numberedMatch[1].trim();
        // Split by common delimiters
        const parts = optionsText.split(/[,\/]|\sor\s|\sand\s/i);
        for (const part of parts) {
            const cleaned = part.trim();
            if (cleaned.length > 0 && cleaned.length < 50) {
                options.push(cleaned);
            }
        }
    }

    // Look for "available in X, Y, Z" or "colors: X, Y"
    const inMatch = message.match(/(?:available in|colors?:?|sizes?:?|models?:?)\s*([^\n.]+)/i);
    if (inMatch && options.length === 0) {
        const parts = inMatch[1].split(/[,\/]|\sor\s|\sand\s/i);
        for (const part of parts) {
            const cleaned = part.trim();
            if (cleaned.length > 0 && cleaned.length < 50) {
                options.push(cleaned);
            }
        }
    }

    return options;
}

// =============================================================================
// Confidence Calculation
// =============================================================================

interface ConfidenceParams {
    availability: 'in_stock' | 'out_of_stock' | 'unclear';
    has_price: boolean;
    has_location: boolean;
    message_length: number;
}

function calculateConfidence(params: ConfidenceParams): number {
    const { availability, has_price, has_location, message_length } = params;

    let confidence = 0;

    // Availability clarity (40%)
    if (availability === 'in_stock' || availability === 'out_of_stock') {
        confidence += 0.4;
    } else {
        confidence += 0.1;
    }

    // Has price (30%)
    if (has_price) {
        confidence += 0.3;
    }

    // Has location (20%)
    if (has_location) {
        confidence += 0.2;
    }

    // Message length bonus (10%)
    if (message_length > 20) {
        confidence += 0.1;
    }

    return Math.round(confidence * 100) / 100;
}

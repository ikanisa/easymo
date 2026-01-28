/**
 * Need Normalization Module
 * 
 * Normalizes client text + OCR fields into taxonomy-based structure
 * for precise vendor matching.
 */

// =============================================================================
// Types
// =============================================================================

export interface NormalizedNeed {
    category: TaxonomyCategory;
    subcategory?: string;
    attributes: NeedAttributes;
    query_string: string;
    confidence: number;
}

export type TaxonomyCategory =
    | 'electronics'
    | 'pharmacy'
    | 'groceries'
    | 'cosmetics'
    | 'hardware'
    | 'unknown';

export interface NeedAttributes {
    brand?: string;
    model?: string;
    accessory_type?: string;
    color?: string;
    drug_name?: string;
    form?: string;
    dose?: string;
    quantity?: number;
    type?: string;
    notes?: string;
}

export interface OcrFields {
    drug_names?: string[];
    prescription_details?: Record<string, string>;
    detected_text?: string;
}

// =============================================================================
// Detection Patterns
// =============================================================================

interface DetectionPattern {
    category: TaxonomyCategory;
    subcategory?: string;
    triggers: RegExp[];
    attributes_extractor?: (text: string) => Partial<NeedAttributes>;
}

const PHONE_BRANDS = ['iphone', 'apple', 'samsung', 'galaxy', 'huawei', 'xiaomi', 'redmi', 'oppo', 'vivo', 'tecno', 'infinix'];
const PHONE_MODELS_PATTERN = /(iphone\s*\d+(?:\s*pro)?(?:\s*max)?|galaxy\s*[szaf]\d+(?:\s*ultra)?|redmi\s*note?\s*\d+)/i;

const DETECTION_PATTERNS: DetectionPattern[] = [
    // Electronics - Computers (check first for laptop/macbook-specific items)
    {
        category: 'electronics',
        subcategory: 'computers',
        triggers: [
            /\b(laptop|macbook|computer|pc|keyboard|mouse|monitor)\b/i,
        ],
        attributes_extractor: extractComputerAttributes,
    },
    // Electronics - Phone Accessories
    {
        category: 'electronics',
        subcategory: 'phone_accessories',
        triggers: [
            /\b(phone\s*case|case|cover|screen\s*protector|charger|cable|earbuds|airpods|headphones)\b/i,
            /\biphone/i,
            /\bgalaxy/i,
            /\bsamsung/i,
        ],
        attributes_extractor: extractPhoneAttributes,
    },
    // Electronics - General
    {
        category: 'electronics',
        subcategory: 'appliances',
        triggers: [
            /\b(blender|iron|fan|heater|microwave|kettle|toaster|refrigerator|tv|television)\b/i,
        ],
    },
    // Pharmacy - Prescription
    {
        category: 'pharmacy',
        subcategory: 'prescription_meds',
        triggers: [
            /\b(prescription|rx|amoxicillin|metformin|amlodipine|omeprazole|paracetamol\s*\d+mg)\b/i,
        ],
        attributes_extractor: extractPharmacyAttributes,
    },
    // Pharmacy - OTC
    {
        category: 'pharmacy',
        subcategory: 'otc',
        triggers: [
            /\b(panadol|ibuprofen|aspirin|bandage|plaster|vitamin|supplement|cough|cold|flu)\b/i,
        ],
    },
    // Groceries
    {
        category: 'groceries',
        triggers: [
            /\b(food|fruit|vegetable|tomato|banana|rice|sugar|flour|milk|nido|bread|meat|fish|egg)\b/i,
        ],
    },
    // Cosmetics
    {
        category: 'cosmetics',
        triggers: [
            /\b(lotion|cream|shampoo|soap|makeup|lipstick|foundation|moisturizer|sunscreen|perfume|deodorant)\b/i,
        ],
    },
    // Hardware
    {
        category: 'hardware',
        triggers: [
            /\b(hammer|screwdriver|nail|screw|wire|pipe|bulb|switch|socket|tool|drill|wrench)\b/i,
        ],
    },
];

// =============================================================================
// Main Normalization Function
// =============================================================================

/**
 * Normalize client text and OCR fields into taxonomy.
 * 
 * @param clientText - Raw text from client message
 * @param ocrFields - Optional OCR extraction results
 * @returns Normalized need with category, subcategory, attributes
 */
export function normalizeNeed(
    clientText: string,
    ocrFields?: OcrFields
): NormalizedNeed {
    const text = clientText.toLowerCase().trim();
    let confidence = 0;
    let matchedPattern: DetectionPattern | null = null;

    // Check OCR-driven detection first (higher confidence)
    if (ocrFields?.drug_names?.length) {
        return normalizeFromOcr(ocrFields, clientText);
    }

    // Pattern matching
    for (const pattern of DETECTION_PATTERNS) {
        for (const trigger of pattern.triggers) {
            if (trigger.test(text)) {
                matchedPattern = pattern;
                confidence = 0.8;
                break;
            }
        }
        if (matchedPattern) break;
    }

    // No match found
    if (!matchedPattern) {
        return {
            category: 'unknown',
            subcategory: undefined,
            attributes: { notes: clientText },
            query_string: clientText,
            confidence: 0.2,
        };
    }

    // Extract attributes
    const attributes = matchedPattern.attributes_extractor
        ? matchedPattern.attributes_extractor(clientText)
        : {};

    // Boost confidence if we extracted specific attributes
    if (attributes.brand || attributes.model) {
        confidence = Math.min(0.95, confidence + 0.1);
    }

    // Build query string for vendor message
    const query_string = buildQueryString(
        matchedPattern.category,
        matchedPattern.subcategory,
        attributes,
        clientText
    );

    return {
        category: matchedPattern.category,
        subcategory: matchedPattern.subcategory,
        attributes,
        query_string,
        confidence,
    };
}

// =============================================================================
// OCR-Driven Normalization
// =============================================================================

function normalizeFromOcr(ocrFields: OcrFields, originalText: string): NormalizedNeed {
    const drugName = ocrFields.drug_names?.[0] || '';
    const details = ocrFields.prescription_details || {};

    const attributes: NeedAttributes = {
        drug_name: drugName,
        form: details.form,
        dose: details.dose,
        quantity: details.quantity ? parseInt(details.quantity, 10) : undefined,
    };

    const query_string = drugName
        ? `${drugName}${details.dose ? ` ${details.dose}` : ''}${details.form ? ` ${details.form}` : ''}`
        : originalText;

    return {
        category: 'pharmacy',
        subcategory: 'prescription_meds',
        attributes,
        query_string,
        confidence: 0.9,
    };
}

// =============================================================================
// Attribute Extractors
// =============================================================================

function extractPhoneAttributes(text: string): Partial<NeedAttributes> {
    const attrs: Partial<NeedAttributes> = {};

    // Brand detection
    for (const brand of PHONE_BRANDS) {
        if (text.toLowerCase().includes(brand)) {
            attrs.brand = brand === 'iphone' || brand === 'apple' ? 'Apple'
                : brand === 'galaxy' || brand === 'samsung' ? 'Samsung'
                    : brand.charAt(0).toUpperCase() + brand.slice(1);
            break;
        }
    }

    // Model detection
    const modelMatch = text.match(PHONE_MODELS_PATTERN);
    if (modelMatch) {
        attrs.model = normalizeModelName(modelMatch[1]);
    }

    // Accessory type
    const accessoryTypes = ['case', 'cover', 'charger', 'cable', 'screen protector', 'earbuds', 'airpods'];
    for (const accessory of accessoryTypes) {
        if (text.toLowerCase().includes(accessory)) {
            attrs.accessory_type = accessory;
            break;
        }
    }

    // Color
    const colors = ['black', 'white', 'blue', 'red', 'green', 'pink', 'purple', 'gold', 'silver', 'clear', 'transparent'];
    for (const color of colors) {
        if (text.toLowerCase().includes(color)) {
            attrs.color = color;
            break;
        }
    }

    return attrs;
}

function extractComputerAttributes(text: string): Partial<NeedAttributes> {
    const attrs: Partial<NeedAttributes> = {};

    // Brand detection
    if (/macbook|apple/i.test(text)) {
        attrs.brand = 'Apple';
    } else if (/dell/i.test(text)) {
        attrs.brand = 'Dell';
    } else if (/hp/i.test(text)) {
        attrs.brand = 'HP';
    } else if (/lenovo|thinkpad/i.test(text)) {
        attrs.brand = 'Lenovo';
    }

    // Type detection (check more specific types first)
    const types = ['keyboard', 'mouse', 'monitor', 'charger', 'adapter', 'laptop'];
    for (const type of types) {
        if (text.toLowerCase().includes(type)) {
            attrs.type = type;
            break;
        }
    }

    return attrs;
}

function extractPharmacyAttributes(text: string): Partial<NeedAttributes> {
    const attrs: Partial<NeedAttributes> = {};

    // Dose detection (e.g., "500mg", "250 mg")
    const doseMatch = text.match(/(\d+)\s*(mg|ml|g|mcg)/i);
    if (doseMatch) {
        attrs.dose = `${doseMatch[1]}${doseMatch[2].toLowerCase()}`;
    }

    // Form detection
    const forms = ['tablets', 'capsules', 'syrup', 'injection', 'cream', 'ointment', 'drops'];
    for (const form of forms) {
        if (text.toLowerCase().includes(form)) {
            attrs.form = form;
            break;
        }
    }

    // Quantity detection
    const qtyMatch = text.match(/(\d+)\s*(tablets?|caps?|pills?|bottles?)/i);
    if (qtyMatch) {
        attrs.quantity = parseInt(qtyMatch[1], 10);
    }

    return attrs;
}

// =============================================================================
// Helpers
// =============================================================================

function normalizeModelName(raw: string): string {
    // Normalize to proper case
    return raw
        .replace(/iphone/i, 'iPhone')
        .replace(/galaxy/i, 'Galaxy')
        .replace(/redmi/i, 'Redmi')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildQueryString(
    category: TaxonomyCategory,
    subcategory: string | undefined,
    attributes: Partial<NeedAttributes>,
    originalText: string
): string {
    const parts: string[] = [];

    if (attributes.brand) parts.push(attributes.brand);
    if (attributes.model) parts.push(attributes.model);
    if (attributes.accessory_type) parts.push(attributes.accessory_type);
    if (attributes.color) parts.push(attributes.color);
    if (attributes.type) parts.push(attributes.type);

    // If we extracted specific parts, use them
    if (parts.length > 0) {
        return parts.join(' ');
    }

    // Fallback to cleaned original text
    return originalText.slice(0, 100);
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Check if a normalized need requires client clarification.
 */
export function needsClarification(need: NormalizedNeed): boolean {
    return need.category === 'unknown' || need.confidence < 0.5;
}

/**
 * Get suggested clarification questions.
 */
export function getClarificationQuestions(need: NormalizedNeed): string[] {
    if (need.category === 'unknown') {
        return [
            'What type of product are you looking for?',
            'Can you provide more details about what you need?',
        ];
    }

    if (need.category === 'electronics' && !need.attributes.brand) {
        return ['What brand/model is this for?'];
    }

    if (need.category === 'pharmacy' && !need.attributes.drug_name) {
        return ['What medication are you looking for? Can you share the prescription?'];
    }

    return [];
}

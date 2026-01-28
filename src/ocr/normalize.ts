/**
 * OCR Normalization Module
 * 
 * Transforms OCR extraction results into marketplace requirements
 * that can be used for vendor outreach.
 */

import type {
    OcrOutput,
    OcrType,
    MedicalPrescriptionFields,
    GeneralDocumentFields,
} from '@insure/ocr-extract';

// =============================================================================
// Types
// =============================================================================

export interface MarketplaceRequirements {
    category: string;
    subcategory?: string;
    items: RequirementItem[];
    location_hints: string[];
    contact_hints: string[];
    requirements_complete: boolean;
    source: 'ocr' | 'text' | 'mixed';
    confidence: number;
}

export interface RequirementItem {
    name: string;
    quantity?: string | number;
    specifications?: Record<string, string>;
    notes?: string;
}

// =============================================================================
// Category Inference Rules
// =============================================================================

const CATEGORY_KEYWORDS: Record<string, string[]> = {
    pharmacy: [
        'medicine', 'medication', 'drug', 'tablet', 'capsule', 'syrup',
        'prescription', 'rx', 'pharmacy', 'pharmaceutical',
    ],
    electronics: [
        'phone', 'laptop', 'computer', 'tablet', 'tv', 'television',
        'camera', 'samsung', 'apple', 'iphone', 'android', 'charger',
    ],
    automotive: [
        'car', 'vehicle', 'tire', 'engine', 'battery', 'oil', 'brake',
        'toyota', 'honda', 'mercedes', 'bmw', 'spare part',
    ],
    construction: [
        'cement', 'brick', 'sand', 'steel', 'iron', 'wood', 'pipe',
        'paint', 'tile', 'roofing', 'insulation',
    ],
    furniture: [
        'chair', 'table', 'desk', 'bed', 'sofa', 'cabinet', 'shelf',
        'mattress', 'wardrobe',
    ],
    food: [
        'rice', 'sugar', 'flour', 'oil', 'milk', 'meat', 'vegetable',
        'fruit', 'bread', 'beverage',
    ],
    clothing: [
        'shirt', 'pants', 'dress', 'shoes', 'jacket', 'uniform',
        'fabric', 'textile',
    ],
    office: [
        'paper', 'printer', 'ink', 'stationery', 'pen', 'notebook',
        'envelope', 'folder',
    ],
};

// =============================================================================
// Normalization Functions
// =============================================================================

/**
 * Normalize OCR output to marketplace requirements
 */
export function normalizeToRequirements(
    output: OcrOutput,
    ocrType: OcrType
): MarketplaceRequirements {
    if (ocrType === 'medical_prescription') {
        return normalizeMedicalPrescription(output);
    }
    return normalizeGeneralDocument(output);
}

/**
 * Normalize medical prescription to pharmacy requirements
 */
function normalizeMedicalPrescription(output: OcrOutput): MarketplaceRequirements {
    const fields = output.extracted.fields as MedicalPrescriptionFields;

    const items: RequirementItem[] = (fields.items ?? []).map((item) => ({
        name: item.drug_name,
        quantity: item.quantity,
        specifications: {
            ...(item.dose && { dose: item.dose }),
            ...(item.form && { form: item.form }),
            ...(item.instructions && { instructions: item.instructions }),
        },
    }));

    // Requirements complete only if high confidence
    const requirementsComplete =
        output.confidence.overall >= 0.75 &&
        !output.warnings.includes('uncertain_drug_name') &&
        items.length > 0;

    return {
        category: 'pharmacy',
        subcategory: 'prescription',
        items,
        location_hints: fields.facility ? [fields.facility] : [],
        contact_hints: [],
        requirements_complete: requirementsComplete,
        source: 'ocr',
        confidence: output.confidence.overall,
    };
}

/**
 * Normalize general document to marketplace requirements
 */
function normalizeGeneralDocument(output: OcrOutput): MarketplaceRequirements {
    const fields = output.extracted.fields as GeneralDocumentFields;

    // Infer category from keywords
    const category = inferCategory(fields);

    // Build items from extracted data
    const items: RequirementItem[] = [];

    // Add products from keywords + brands
    if (fields.product_keywords?.length > 0) {
        fields.product_keywords.forEach((keyword) => {
            const brand = fields.brands?.find((b) =>
                keyword.toLowerCase().includes(b.toLowerCase()) ||
                b.toLowerCase().includes(keyword.toLowerCase())
            );

            items.push({
                name: keyword,
                specifications: {
                    ...(brand && { brand }),
                },
            });
        });
    }

    // Add brand + model combinations not already captured
    if (fields.brands?.length > 0 && fields.models?.length > 0) {
        fields.brands.forEach((brand, i) => {
            const model = fields.models?.[i];
            if (model) {
                const exists = items.some((item) =>
                    item.name.toLowerCase().includes(brand.toLowerCase())
                );
                if (!exists) {
                    items.push({
                        name: `${brand} ${model}`,
                        specifications: { brand, model },
                    });
                }
            }
        });
    }

    // Add quantities if present
    if (fields.quantities?.length > 0 && items.length > 0) {
        items.forEach((item, i) => {
            if (fields.quantities?.[i]) {
                item.quantity = fields.quantities[i];
            }
        });
    }

    // Add colors as specifications
    if (fields.colors?.length > 0) {
        items.forEach((item) => {
            if (fields.colors?.[0]) {
                item.specifications = {
                    ...item.specifications,
                    color: fields.colors[0],
                };
            }
        });
    }

    // Requirements complete if we have items and reasonable confidence
    const requirementsComplete =
        output.confidence.overall >= 0.6 &&
        items.length > 0 &&
        category !== 'general';

    return {
        category,
        items,
        location_hints: fields.addresses_or_landmarks ?? [],
        contact_hints: fields.phone_numbers ?? [],
        requirements_complete: requirementsComplete,
        source: 'ocr',
        confidence: output.confidence.overall,
    };
}

/**
 * Infer category from extracted fields
 */
function inferCategory(fields: GeneralDocumentFields): string {
    const allText = [
        ...(fields.product_keywords ?? []),
        ...(fields.brands ?? []),
        ...(fields.models ?? []),
        fields.notes ?? '',
    ].join(' ').toLowerCase();

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        for (const keyword of keywords) {
            if (allText.includes(keyword)) {
                return category;
            }
        }
    }

    return 'general';
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Check if requirements are complete enough for vendor outreach
 */
export function isReadyForOutreach(requirements: MarketplaceRequirements): boolean {
    return (
        requirements.requirements_complete &&
        requirements.items.length > 0 &&
        requirements.confidence >= 0.6
    );
}

/**
 * Get missing fields that need clarification
 */
export function getMissingFields(
    requirements: MarketplaceRequirements,
    ocrType: OcrType
): string[] {
    const missing: string[] = [];

    if (requirements.items.length === 0) {
        missing.push(ocrType === 'medical_prescription' ? 'medications' : 'products');
    }

    if (requirements.category === 'general') {
        missing.push('product_category');
    }

    if (ocrType === 'medical_prescription') {
        const hasUncertainDrug = requirements.items.some(
            (item) => !item.name || item.name.trim() === ''
        );
        if (hasUncertainDrug) {
            missing.push('drug_name');
        }
    }

    return missing;
}
